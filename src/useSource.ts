import { useEffect, useRef, useState } from 'react';
import { API, appendPage, emptyEvidence, evidenceFresh, measurementFresh, parseStatus, type Evidence, type Measurement } from './evidence';
import type { SourceStatus } from './domain';
export interface Source {
  evidence: Evidence; measurement: Measurement | null; status: SourceStatus; message: string;
  lastSuccess: number | null; lastEvidenceSuccess: number | null; reset: number; retryAt: number;
}
const initial = (): Source => ({evidence:emptyEvidence(),measurement:null,status:'SYNCING',message:'Reading the hardware history…',lastSuccess:null,lastEvidenceSuccess:null,reset:0,retryAt:0});
class FetchError extends Error { constructor(message: string, public retryMs=10_000){super(message);} }
async function get(url: string, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10_000)]),cache:'no-store',credentials:'omit'});}
  catch {throw new FetchError('Cannot reach the source. Check your connection or retry.');}
  if(!response.ok){
    const header=response.headers.get('Retry-After');
    const delay=header && /^\d+$/.test(header)?Number(header)*1000:10_000;
    throw new FetchError(response.status===429?'The source is rate limiting requests. Retrying after its cooldown.':`Source unavailable (HTTP ${response.status}). Retrying automatically.`,Math.max(1000,Math.min(delay,3_600_000)));
  }
  try{return await response.json();}catch{throw new FetchError('The source returned unreadable data. Retrying automatically.');}
}
export function useSource(enabled: boolean, now: number){
  const [source,setSource]=useState<Source>(initial);
  const [generation,setGeneration]=useState(0);
  const ref=useRef(source);
  const update=(fn:(s:Source)=>Source)=>{ref.current=fn(ref.current);setSource(ref.current);};
  const retry=()=>{if(Date.now()>=ref.current.retryAt)setGeneration(g=>g+1);};
  useEffect(()=>{
    if(!enabled)return;
    const controller=new AbortController();let stopped=false;let statusTimer:ReturnType<typeof setTimeout>;let runsTimer:ReturnType<typeof setTimeout>;
    let statusFailed=false,runsFailed=false;
    const fail=(error:unknown,part:'status'|'runs')=>{
      if(stopped)return 10_000;
      if(part==='status')statusFailed=true;else runsFailed=true;
      const message=error instanceof Error?error.message:'Source unavailable. Retry in a moment.';
      const delay=error instanceof FetchError?error.retryMs:15_000;
      update(s=>({...s,status:'OFFLINE',message,retryAt:Date.now()+delay}));return delay;
    };
    const statusLoop=async()=>{
      let delay=10_000;
      try{
        const m=parseStatus(await get(`${API}/status`,controller.signal),Date.now());if(stopped)return;
        statusFailed=false;
        update(s=>{
          const changed=s.measurement && (s.measurement.installation!==m.installation || s.measurement.epoch!==m.epoch
            || m.observedAt<s.measurement.observedAt || BigInt(m.work)<BigInt(s.measurement.work));
          return {...s,measurement:m,lastSuccess:Date.now(),reset:s.reset+(changed||m.coreStatus==='COUNTER_FAULT'?1:0),
            ...(changed?{evidence:emptyEvidence()}:{}),status:runsFailed?'OFFLINE':'SYNCING',message:runsFailed?s.message:'Reading the hardware history…'};
        });
      }catch(e){delay=fail(e,'status');}
      if(!stopped)statusTimer=setTimeout(statusLoop,delay);
    };
    const runLoop=async()=>{
      let delay=5_000;
      try{
        const before=ref.current.evidence;
        const path=`${API}/measurement/runs?limit=100${before.cursor?'&cursor='+encodeURIComponent(before.cursor):''}`;
        const raw=await get(path,controller.signal);if(stopped)return;
        // Ignore a response for an evidence stream reset while this request was in flight.
        if(ref.current.evidence!==before){runsTimer=setTimeout(runLoop,700);return;}
        const evidence=appendPage(before,raw,Date.now());
        if(ref.current.measurement && evidence.installation!==ref.current.measurement.installation)throw new Error('Status and passages refer to different installations.');
        runsFailed=false;delay=evidence.caughtUp?5_000:700;
        update(s=>({...s,evidence,lastEvidenceSuccess:evidence.caughtUp?Date.now():s.lastEvidenceSuccess,
          status:statusFailed?'OFFLINE':'SYNCING',message:statusFailed?s.message:`Reading the hardware history… ${evidence.pages} pages checked.`}));
      }catch(e){delay=fail(e,'runs');}
      if(!stopped)runsTimer=setTimeout(runLoop,delay);
    };
    void statusLoop();void runLoop();
    return()=>{stopped=true;controller.abort();clearTimeout(statusTimer);clearTimeout(runsTimer);};
  },[enabled,generation]);
  let status=source.status,message=source.message;
  if(source.status!=='OFFLINE' && source.measurement){
    const measurement=measurementFresh(source.measurement,now);
    if(!measurement || (source.evidence.caughtUp && !evidenceFresh(source.evidence,now))){status='STALE';message=source.measurement.coreStatus==='COUNTER_FAULT'?'The wheel reported a counter fault. Live rounds are paused.':'Waiting for fresh hardware evidence. New rounds are paused.';}
    else if(evidenceFresh(source.evidence,now)){status='LIVE';message='Hardware evidence is current.';}
  }
  return {...source,status,message,retry};
}
