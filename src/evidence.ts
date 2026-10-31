import { LIVE_DURATION, type WindowResult } from './domain';

export const API = 'https://api.squeekchain.com/v1';
export const DOCS = 'https://docs.squeekchain.com/developers/api/';
export const FRESH_MS = 120_000;
const RETAIN_MS = 30 * 60_000;
export class EvidenceError extends Error {}
export function record(x: unknown): Record<string,unknown> {
  if (!x || typeof x!=='object' || Array.isArray(x)) throw new EvidenceError('The source returned an invalid object.');
  return x as Record<string,unknown>;
}
function text(x: unknown): string { if(typeof x!=='string' || !x) throw new EvidenceError('A source identifier is missing.'); return x; }
function integer(x: unknown): number { if(typeof x!=='number' || !Number.isSafeInteger(x) || x<0) throw new EvidenceError('A source value is invalid.'); return x; }
function decimal(x: unknown): bigint { if(typeof x!=='string' || !/^\d+$/.test(x)) throw new EvidenceError('A work counter is invalid.'); return BigInt(x); }
export function timestampNs(value: unknown): bigint {
  const x=text(value);
  const m=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(x);
  if(!m || !Number.isFinite(Date.parse(x))) throw new EvidenceError('A source timestamp is invalid.');
  return BigInt(Date.parse(m[1]+'Z'))*1_000_000n+BigInt((m[2]??'').padEnd(9,'0'));
}
const millis = (value: unknown) => Number(timestampNs(value)/1_000_000n);
export interface Measurement {
  installation: string; generatedAt: number; observedAt: number; receivedAt: number; epoch: string;
  work: string; freshness: 'online' | 'stale'; coreStatus: 'IDLE' | 'ACTIVE' | 'COUNTER_FAULT';
  rpmMilli: number; staleMs: number;
}
export function parseStatus(raw: unknown, now: number): Measurement {
  const d=record(raw);
  if(d.schemaVersion!==1) throw new EvidenceError('The status schema changed. Live play is paused.');
  const m=record(d.measurement);
  if(m.provenance!=='hardware') throw new EvidenceError('The source is not reporting hardware measurements.');
  if(!['online','stale'].includes(String(m.freshness)) || !['IDLE','ACTIVE','COUNTER_FAULT'].includes(String(m.coreStatus))) throw new EvidenceError('Unknown device state.');
  const generatedAt=millis(d.generatedAt), observedAt=millis(m.observedAt), receivedAt=millis(m.receivedAt);
  if(generatedAt>now+1_000 || now-generatedAt>10_000 || observedAt>generatedAt+1_000 || receivedAt>generatedAt+1_000) throw new EvidenceError('Source and browser clocks disagree. Check your device clock.');
  return {installation:text(d.installationId), generatedAt, observedAt, receivedAt, epoch:text(m.counterEpoch), work:decimal(m.cumulativeWorkUnits).toString(),
    freshness:m.freshness as Measurement['freshness'], coreStatus:m.coreStatus as Measurement['coreStatus'], rpmMilli:integer(m.rpmMilli),
    staleMs:Math.min(integer(m.staleAfterSeconds)*1000,FRESH_MS)};
}
export function measurementFresh(m: Measurement, now: number): boolean {
  return m.freshness==='online' && m.coreStatus!=='COUNTER_FAULT' && now-m.observedAt<=m.staleMs && now-m.receivedAt<=m.staleMs && now-m.generatedAt<=m.staleMs;
}
export interface Passage { ns: string; count: number }
interface Break { from: number; through: number }
export interface Evidence {
  installation: string | null; cursor: string | null; total: number; anchor: number;
  points: Passage[]; breaks: Break[]; firstAt: number | null; retainedFrom: number;
  through: number | null; generatedAt: number | null; freshness: string;
  lastNs: string | null; continuity: string | null; lastSegment: string | null;
  pages: number; caughtUp: boolean;
}
export const emptyEvidence = (): Evidence => ({installation:null,cursor:null,total:0,anchor:0,points:[],breaks:[],firstAt:null,retainedFrom:0,
  through:null,generatedAt:null,freshness:'unavailable',lastNs:null,continuity:null,lastSegment:null,pages:0,caughtUp:false});

/** Commit a page atomically. Coverage is trusted only after the documented empty page. */
export function appendPage(previous: Evidence, raw: unknown, now: number): Evidence {
  const d=record(raw);
  if(d.schemaVersion!=='measurement-runs.v1' || d.authority!=='pi-device-key' || d.certifiedCoreWork!==false) throw new EvidenceError('The passage evidence schema changed.');
  const installation=text(d.installationId);
  if(previous.installation && previous.installation!==installation) throw new EvidenceError('The source installation changed.');
  if(!Array.isArray(d.items) || d.items.length>100 || !['fresh','stale','unavailable'].includes(String(d.freshness))) throw new EvidenceError('The passage feed is invalid.');
  const generatedAt=millis(d.generatedAt);
  if(generatedAt>now+1_000) throw new EvidenceError('Source and browser clocks disagree. Check your device clock.');
  const s: Evidence={...previous,points:[...previous.points],breaks:[...previous.breaks],installation,pages:previous.pages+1,generatedAt};
  if(d.coverageStartAt!==null) s.firstAt=millis(d.coverageStartAt);
  const cursor=d.nextCursor===null?null:text(d.nextCursor);
  if(d.items.length && (!cursor || cursor===previous.cursor)) throw new EvidenceError('The passage cursor did not advance.');
  for(const rawItem of d.items){
    const item=record(rawItem), id=text(item.segmentId), continuity=text(item.continuityId);
    if(id===s.lastSegment) throw new EvidenceError('Duplicate passage segment.');
    if(item.provenance!=='hardware' || item.measurementEligible!==true) throw new EvidenceError('The passage feed contains ineligible or non-hardware evidence.');
    if(!Array.isArray(item.passages) || !item.passages.length || decimal(item.workUnits)!==BigInt(item.passages.length)) throw new EvidenceError('Passages do not match the work counter.');
    if(typeof item.discontinuity!=='boolean') throw new EvidenceError('Missing counter continuity information.');
    const start=timestampNs(item.startAt), end=timestampNs(item.endAt);
    if(end<start || end>BigInt(generatedAt+2000)*1_000_000n) throw new EvidenceError('Passage times are out of range.');
    if(s.lastNs && !item.discontinuity && (timestampNs(item.previousAt).toString()!==s.lastNs || continuity!==s.continuity)) throw new EvidenceError('A passage segment is missing or the counter reset.');
    if(s.lastNs && item.discontinuity) s.breaks.push({from:Number(BigInt(s.lastNs)/1_000_000n),through:Number(start/1_000_000n)});
    for(let i=0;i<item.passages.length;i++){
      const p=record(item.passages[i]), at=timestampNs(p.at);
      // Absolute `at` is the documented passage time. Historical offsetNs can disagree; it is not used.
      if((i===0 && at!==start) || (i===item.passages.length-1 && at!==end)
        || (s.lastNs && at<=BigInt(s.lastNs))) throw new EvidenceError('Passage order or timestamps are inconsistent.');
      s.total++;
      if(!Number.isSafeInteger(s.total)) throw new EvidenceError('The work counter exceeds browser precision.');
      s.points.push({ns:at.toString(),count:s.total});s.lastNs=at.toString();
    }
    s.lastSegment=id;s.continuity=continuity;
  }
  s.cursor=cursor??s.cursor;
  s.caughtUp=d.items.length===0;
  s.freshness=String(d.freshness);
  if(s.caughtUp && d.coverageThroughAt!==null){
    const through=millis(d.coverageThroughAt);
    if(through>generatedAt+2000 || (s.lastNs && BigInt(through+1)*1_000_000n<BigInt(s.lastNs)) || (s.through!==null && through<s.through)) throw new EvidenceError('The coverage boundary is inconsistent.');
    s.through=through;
  }
  // Keep an exact cumulative anchor while discarding old timestamps, not their counts.
  const cutoff=now-RETAIN_MS;
  let remove=0;
  while(remove<s.points.length && BigInt(s.points[remove].ns)<BigInt(cutoff)*1_000_000n){s.anchor=s.points[remove].count;remove++;}
  s.points=s.points.slice(remove);
  s.breaks=s.breaks.filter(b=>b.through>=cutoff);
  s.retainedFrom=Math.max(s.retainedFrom,cutoff);
  return s;
}
export function evidenceFresh(s: Evidence, now: number): boolean {
  return s.caughtUp && s.freshness==='fresh' && s.through!==null && now-s.through<=FRESH_MS
    && s.generatedAt!==null && now-s.generatedAt<=FRESH_MS;
}
export function windowEvidence(s: Evidence, start: number, end: number): WindowResult | null {
  if(!s.caughtUp || s.firstAt===null || s.through===null || start<s.firstAt || start<s.retainedFrom || end>s.through || end<=start
    || s.breaks.some(b=>b.from<end && b.through>=start)) return null;
  // Window is (start, end]: equal-at-end passages count; equal-at-start passages do not.
  const cumulativeAt=(time: number)=>{
    const ns=BigInt(time)*1_000_000n;
    let count=s.anchor;
    for(const p of s.points){if(BigInt(p.ns)>ns) break;count=p.count;}
    return count;
  };
  const startCount=cumulativeAt(start),endCount=cumulativeAt(end);
  return {start,end,work:endCount-startCount,startCount,endCount};
}
export function recentWindows(s: Evidence, now: number): WindowResult[] {
  if(!s.through) return [];
  const last=Math.floor(Math.min(now,s.through)/LIVE_DURATION)*LIVE_DURATION;
  const windows: WindowResult[]=[];
  for(let n=5;n>0;n--){const start=last-n*LIVE_DURATION;const w=windowEvidence(s,start,start+LIVE_DURATION);if(w) windows.push(w);}
  return windows;
}
