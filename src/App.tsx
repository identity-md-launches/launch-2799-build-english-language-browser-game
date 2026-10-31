import { useEffect, useRef, useState } from 'react';
import { completeRound, DEMO_DURATION, demoWindows, emptyProgress, labelChoice, lockRound, makeDraft, newSave, parseSave, SAVE_KEY, SETTLEMENT_GRACE, type Choice, type Draft, type Mode, type Save } from './domain';
import { API, DOCS, recentWindows, windowEvidence } from './evidence';
import { useSource } from './useSource';
import { Icon, Vacuum, Wheel } from './Artwork';

const number = (n: number) => n.toLocaleString('en-US',{maximumFractionDigits:1});
const time = (n: number) => new Date(n).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'})+' UTC';
const countdown = (ms: number) => {const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;};
function readInitial(){
  try{const raw=localStorage.getItem(SAVE_KEY);return {save:parseSave(raw)??newSave(),warning:raw&&!parseSave(raw)?'Saved progress could not be read. A new game has been started.':''};}
  catch{return {save:newSave(),warning:'Browser storage is unavailable. Progress will last for this visit only.'};}
}
export function App(){
  const [initial]=useState(readInitial);
  const [save,setSave]=useState<Save>(initial.save);
  const [storageWarning,setStorageWarning]=useState(initial.warning);
  const [now,setNow]=useState(Date.now());
  const [drafts,setDrafts]=useState<Partial<Record<Mode,Draft>>>({});
  const [choice,setChoice]=useState<Choice|null>(null);
  const [notice,setNotice]=useState('');
  const [historyFilter,setHistoryFilter]=useState('all');
  const dialog=useRef<HTMLDialogElement>(null);
  const audio=useRef<AudioContext|null>(null);
  const source=useSource(save.mode==='live'||!!save.live.active,now);
  const seenReset=useRef(source.reset);
  const soundRef=useRef(save.sound);soundRef.current=save.sound;
  const mode=save.mode,progress=save[mode],active=progress.active,draft=active??drafts[mode];
  const isDemo=mode==='demo';
  const ready=isDemo||source.status==='LIVE';
  const last=progress.history[0];
  const [seenResult,setSeenResult]=useState<string|null>(null);
  const showResult=!!last && last.id!==seenResult && !active && !drafts[mode];

  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch{setStorageWarning('Progress could not be saved. Export JSON before closing this tab.');}
  },[save]);
  useEffect(()=>{
    const sync=(event:StorageEvent)=>{if(event.key===SAVE_KEY&&event.newValue){const next=parseSave(event.newValue);if(next){setSave(next);setDrafts({});setNotice('Progress updated from another tab.');}}};
    window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
  },[]);
  useEffect(()=>{
    if(!active && !drafts[mode] && !showResult && ready){
      const windows=isDemo?demoWindows(progress):recentWindows(source.evidence,now);
      setDrafts(d=>({...d,[mode]:makeDraft(mode,windows,now,progress.wins+progress.losses)}));
    }
  },[mode,active,drafts,showResult,ready,progress,isDemo,source.evidence,now]);
  useEffect(()=>{
    const reset=source.reset!==seenReset.current;seenReset.current=source.reset;
    setSave(current=>{
      let next=current;
      for(const m of ['live','demo'] as const){
        const p=next[m],r=p.active;if(!r)continue;
        let updated=p;
        if(m==='demo' && now>=r.end){
          updated=completeRound(p,{start:r.start,end:r.end,work:r.demoTotal!,startCount:0,endCount:r.demoTotal!},now);
        }else if(m==='live'){
          const measurement=source.measurement;
          if(reset || (measurement && (measurement.epoch!==r.epoch || measurement.installation!==r.installation || measurement.coreStatus==='COUNTER_FAULT'))){
            updated=completeRound(p,null,now,'The hardware counter changed or reported a fault. No score or damage applied.');
          }else if(now>r.end+SETTLEMENT_GRACE){
            updated=completeRound(p,null,now,'No verifiable coverage arrived within two minutes of the window ending.');
          }else if(now>=r.end && source.status==='LIVE'){
            const evidence=windowEvidence(source.evidence,r.start,r.end);
            if(evidence)updated=completeRound(p,evidence,now);
            else if(source.evidence.through!==null && source.evidence.through>=r.end){
              updated=completeRound(p,null,now,'The passage record has a gap or a counter discontinuity in this window.');
            }
          }
        }
        if(updated!==p)next={...next,[m]:updated};
      }
      return next;
    });
  },[now,source.status,source.evidence,source.measurement,source.reset]);
  const resultIds=useRef({live:save.live.history[0]?.id,demo:save.demo.history[0]?.id});
  useEffect(()=>{
    for(const m of ['live','demo'] as const){
      const h=save[m].history[0];
      if(h && h.id!==resultIds.current[m]){
        resultIds.current[m]=h.id;
        if(soundRef.current && audio.current && h.result!=='void'){
          const ctx=audio.current;
          const osc=ctx.createOscillator(),gain=ctx.createGain();
          osc.type='sine';osc.frequency.setValueAtTime(h.result==='correct'?660:220,ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(h.result==='correct'?990:165,ctx.currentTime+.18);
          gain.gain.setValueAtTime(.05,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.3);
          osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.3);
        }
      }
    }
  },[save.live.history,save.demo.history]);
  function changeMode(m:Mode){setSave(s=>({...s,mode:m}));setChoice(null);setSeenResult(null);setNotice('');setHistoryFilter('all');}
  function lock(){
    if(!choice || !draft || active || !ready)return;
    const at=Date.now();
    if(save.sound){try{audio.current??=new AudioContext();void audio.current.resume().catch(()=>setNotice('Sound is unavailable in this browser.'));}catch{setNotice('Sound is unavailable in this browser.');}}
    if(!isDemo && (!source.measurement || at-source.measurement.observedAt>120_000)){setNotice('Fresh hardware data is needed before locking. Please retry the source.');return;}
    const random=new Uint32Array(1);
    if(isDemo)crypto.getRandomValues(random);
    // The baseline above is frozen before the simulator samples its result.
    const total=isDemo?4+(random[0]%19):undefined;
    const round=lockRound(draft,choice,at,isDemo?'local-demo':source.measurement!.installation,isDemo?'demo':source.measurement!.epoch,total);
    setSave(s=>({...s,[mode]:{...s[mode],active:round}}));
    setDrafts(d=>({...d,[mode]:undefined}));setNotice('');
  }
  function nextRound(){setSeenResult(last?.id??null);setDrafts(d=>({...d,[mode]:undefined}));setChoice(null);setNotice('');}
  async function toggleSound(){
    if(!save.sound){try{audio.current??=new AudioContext();await audio.current.resume();}catch{setNotice('Sound is unavailable in this browser.');return;}}
    setSave(s=>({...s,sound:!s.sound}));
  }
  function exportJson(){
    const data={game:'Squeek Wheel Oracle',exportedAt:new Date().toISOString(),rulesVersion:1,
      disclaimer:'Local single-player scores are editable and not tamper-proof. DEMO scores are synthetic. No monetary value.',
      source:{status:`${API}/status`,passages:`${API}/measurement/runs`,documentation:DOCS,metric:'accepted wheel-magnet passages (work units)',window:'(start, end]',lastSuccessfulUpdate:source.lastSuccess},progress:save};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`squeek-wheel-oracle-${new Date().toISOString().slice(0,10)}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Progress exported as JSON.');
  }
  function resetProgress(){if(window.confirm(`Reset all ${mode} scores, history and any active ${mode} round? This cannot be undone.`)){
    setSave(s=>({...s,[mode]:emptyProgress()}));setDrafts(d=>({...d,[mode]:undefined}));setSeenResult(null);setChoice(null);setNotice(`${isDemo?'Demo':'Live'} progress reset.`);
  }}
  const phase=active?(now<active.start?'locked':now<active.end?'measuring':'settling'):showResult?'result':'ready';
  const remaining=active?phase==='locked'?active.start-now:phase==='measuring'?active.end-now:Math.max(0,active.end+SETTLEMENT_GRACE-now):draft?.duration??(isDemo?DEMO_DURATION:60_000);
  const running=isDemo?phase==='measuring':source.status==='LIVE'&&source.measurement?.coreStatus==='ACTIVE';
  const currentWork=active && phase!=='locked'?(isDemo?Math.floor(active.demoTotal!*Math.min(1,Math.max(0,(now-active.start)/active.duration))):windowEvidence(source.evidence,active.start,Math.min(active.end,source.evidence.through??active.start))?.work):null;
  const displayedWork=active?currentWork:last?.actual;
  const filterHistory=progress.history.filter(h=>historyFilter==='all'||h.result===historyFilter);
  const forecastValue=draft?.forecast??last?.forecast;
  const statusLabel=isDemo?'DEMO':source.status;
  return <>
    <a href="#game" className="skip">Skip to the game</a>
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#game" aria-label="Squeek Wheel Oracle, game"><Icon name="wheel"/><span><b>Squeek</b> Wheel Oracle</span></a>
        <div className="utilities">
          <button className="icon-button" aria-label={save.sound?'Turn sound off':'Turn sound on'} aria-pressed={save.sound} onClick={()=>void toggleSound()}><Icon name={save.sound?'sound':'mute'}/></button>
          <button className="help-button" aria-label="How to play" onClick={()=>dialog.current?.showModal()}><Icon name="help"/><span>How to play</span></button>
        </div>
      </header>
      <main id="game">
        <div className="intro">
          <div><h1>Tiny paws. <span>Big predictions.</span></h1><p>A real hamster powers this prediction game.</p></div>
          <div className="mode-picker" aria-label="Game mode">
            <button aria-pressed={!isDemo} onClick={()=>changeMode('live')}>Play live <span>60s</span></button>
            <button aria-pressed={isDemo} onClick={()=>changeMode('demo')}>Try demo <span>8s</span></button>
          </div>
        </div>
        {isDemo && <div className="demo-banner"><strong>DEMO</strong><span>Synthetic activity · separate practice score</span>{save.live.active && <span>A live round is still running.</span>}</div>}
        {storageWarning && <p className="warning" role="status">{storageWarning}</p>}
        <div className="arena">
          <section className="reactor" aria-label="Hamster wheel">
            <div className="scene-top"><span className="scene-name"><span className="status-dot"/>Reactor No. {String(progress.bosses+1).padStart(2,'0')}</span><span className="scene-state">{running?'Wheel turning':isDemo?'Practice reactor':source.status==='LIVE'?'Wheel resting':'Awaiting signal'}</span></div>
            <Wheel running={!!running} motion={save.motion}/>
            <div className="scene-bottom"><span>WHEELY9000 <span className="muted">/</span> {isDemo?'simulation':'hardware feed'}</span><button className="icon-button" aria-label={save.motion?'Pause animation':'Resume animation'} aria-pressed={!save.motion} onClick={()=>setSave(s=>({...s,motion:!s.motion}))}><Icon name={save.motion?'pause':'play'}/></button></div>
            <div className="reactor-readings">
              <div><span>{active?'Measured work':'Last window'}</span><strong>{displayedWork!==null&&displayedWork!==undefined?number(displayedWork):'—'} <small>units</small></strong></div>
              <div><span>{phase==='locked'?'Starts in':phase==='settling'?'Evidence deadline':'Window timer'}</span><strong>{countdown(remaining)}</strong></div>
              <div><span>Round</span><strong>{String(progress.wins+progress.losses+progress.history.filter(h=>h.result==='void').length+1).padStart(2,'0')}</strong></div>
            </div>
          </section>
          <section className="prediction" aria-labelledby="prediction-title">
            <div className="section-top"><h2 id="prediction-title">{phase==='result'?'The wheel has spoken':phase==='ready'?'Make your prediction':'Prediction locked'}</h2><span className={`feed-state ${statusLabel.toLowerCase()}`}><i/>{statusLabel}</span></div>
            {showResult && last ? <div className={`result result-${last.result}`}>
              <span className="result-symbol" aria-hidden="true">{last.result==='correct'?'✓':last.result==='void'?'∅':'↗'}</span>
              <h3>{last.result==='correct'?'Good call.':last.result==='void'?'Round void.':'A twist in the wheel.'}</h3>
              <div className="result-score">{last.result==='void'?'No score change':`+${last.points} points`}</div>
              <p>{last.actual===null?last.reason:`${number(last.actual)} work units. Target: ${number(last.target)}. You called ${labelChoice(last.choice)}.`}</p>
              {last.result==='correct' && <p className="accent">20 boss damage{last.bonus?` · +${last.bonus} streak bonus included`:''}</p>}
              <button className="primary" onClick={nextRound}>Play next round <Icon name="arrow"/></button>
            </div> : <>
              <div className="target-row"><div><span className="field-label">Target wheel work</span><div className="target-number">{draft?number(draft.target):'…'} <span>units</span></div></div><div className="window-label"><strong>{isDemo?'8':'60'} seconds</strong><span>{isDemo?'simulated window':'future window'}</span></div></div>
              <div className="choices" role="group" aria-label="Choose your prediction">
                <button className={`choice ${(active?.choice??choice)==='under'?'selected':''}`} aria-pressed={(active?.choice??choice)==='under'} disabled={!!active} onClick={()=>setChoice('under')}><span className="choice-label"><span aria-hidden="true">↓</span> UNDER</span><small>Below {draft?.target??'target'}</small></button>
                <button className={`choice ${(active?.choice??choice)==='over'?'selected':''}`} aria-pressed={(active?.choice??choice)==='over'} disabled={!!active} onClick={()=>setChoice('over')}><span className="choice-label"><span aria-hidden="true">↑</span> AT/OVER</span><small>{draft?.target??'Target'} or more</small></button>
              </div>
              <button className="primary" onClick={lock} disabled={!choice||!!active||!ready||!draft}>
                {active?phase==='locked'?`Locked · starts in ${Math.max(0,Math.ceil(remaining/1000))}s`:phase==='measuring'?`Measuring · ${countdown(remaining)}`:'Waiting for verified evidence':choice?`Lock ${labelChoice(choice)}`:'Choose a prediction'}<Icon name={active?'wheel':'arrow'}/>
              </button>
              <p className="lock-hint">{active?`${time(active.start)} – ${time(active.end)}`:'Lock your choice. The window starts 3 seconds later.'}</p>
              {active && phase==='settling' && <p className="inline-note">Waiting for source coverage through the end. No result is guessed.</p>}
              {!isDemo&&source.status!=='LIVE'&&<div className="source-warning" role="status"><p>{source.message}</p>{source.status!=='SYNCING'&&<button className="text-button" onClick={source.retry} disabled={now<source.retryAt}>Retry source{now<source.retryAt?` in ${Math.ceil((source.retryAt-now)/1000)}s`:''}</button>}{source.status==='SYNCING'&&<button className="text-button" onClick={()=>changeMode('demo')}>Play an 8-second demo while it loads</button>}</div>}
            </>}
            <div className="baseline-call"><Icon name="spark"/><div><span>Baseline calls <strong>{labelChoice(forecastValue?.choice??null)}</strong></span><small>{forecastValue?.mean!==null&&forecastValue?.mean!==undefined?`Mean ${number(forecastValue.mean)} units · last ${forecastValue.samples.length} completed windows`:'Learning from completed windows. No forecast yet.'}</small></div></div>
            <div className="source-line">{isDemo?'Local simulator. No real hamster data.':<><a href={DOCS+'#measurement-runs'} target="_blank" rel="noreferrer">Squeekchain API ↗</a><span>Updated {source.lastEvidenceSuccess?time(source.lastEvidenceSuccess):'not yet'}</span></>}</div>
          </section>
        </div>
        <section className="boss-strip" aria-labelledby="boss-title">
          <Vacuum hp={progress.bossHp}/>
          <div className="boss-info"><div className="boss-title-row"><h2 id="boss-title">Vacuum of the Void</h2><span className="boss-level">Boss {String(progress.bosses+1).padStart(2,'0')}</span></div><div className="health-row"><div className="health-bar" role="progressbar" aria-label="Boss health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.bossHp}>{[20,40,60,80,100].map(v=><span key={v} className={progress.bossHp>=v?'filled':''}/>)}</div><strong>{progress.bossHp}<span> / 100 HP</span></strong></div><p>Five correct calls. One less vacuum in the universe.</p></div>
          <div className="score-strip"><div><span>Points</span><strong>{number(progress.score)}</strong></div><div><span>Streak</span><strong>{progress.streak}<small> wins</small></strong></div><div><span>Bosses beaten</span><strong>{progress.bosses}</strong></div></div>
        </section>
        <div className="narrative" role="status"><Icon name="spark"/><span>{progress.lastMessage}</span></div>
        <div className="lower-grid">
          <section className="history" aria-labelledby="history-title">
            <div className="section-top"><h2 id="history-title">Round chronicles</h2><button className="text-button" onClick={exportJson}><Icon name="download"/>Export JSON</button></div>
            <div className="history-toolbar"><span>{progress.wins} correct · {progress.losses} missed</span><label>Show <select value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)}><option value="all">All rounds</option><option value="correct">Correct</option><option value="incorrect">Missed</option><option value="void">Void</option></select></label></div>
            {filterHistory.length?<ol className="history-list">{filterHistory.slice(0,10).map(h=><li key={h.id}><div className={`history-mark ${h.result}`} aria-label={h.result}>{h.result==='correct'?'✓':h.result==='void'?'∅':'×'}</div><div className="history-description"><strong>{h.actual===null?'Unverifiable window':`${number(h.actual)} units / target ${number(h.target)}`}</strong><span>{labelChoice(h.choice)} · {h.mode==='demo'?'Demo · ':''}{time(h.start)}{h.bonus?` · ${h.bonus} bonus`:''}</span>{h.result==='void'&&<small>{h.reason}</small>}</div><strong className="history-points">+{h.points}</strong></li>)}</ol>:<div className="empty-history"><Icon name="wheel"/><strong>{progress.history.length?'No rounds match this filter.':'Your story starts with a prediction.'}</strong><p>{progress.history.length?'Choose All rounds to see your history.':'Complete a round to see your call, the measured result and your points here.'}</p></div>}
            {filterHistory.length>10&&<p className="muted small">Showing the latest 10. Export JSON for up to 100 stored rounds.</p>}
          </section>
          <section className="opponent" aria-labelledby="opponent-title"><div className="section-top"><h2 id="opponent-title">Human vs. algorithm</h2><Icon name="spark"/></div><div className="versus"><div><strong>{progress.wins}</strong><span>You</span></div><span className="versus-separator">:</span><div><strong>{progress.algorithmWins}</strong><span>Baseline</span></div></div><p>A statistical baseline, not an LLM. It predicts the mean of the last five completed windows with the same metric and duration.</p><details><summary>See the reasoning</summary><div className="details-content"><p>{forecastValue?.mean===null||!forecastValue?'No completed windows yet. The baseline abstains until it has evidence.':`Recent work: ${forecastValue.samples.map(s=>number(s.work)).join(', ')} units. Mean: ${number(forecastValue.mean)}. A mean at or above the frozen target predicts AT/OVER.`}</p><p>Only windows ending before the forecast was prepared are used. Targets alternate between 110%, 90%, 105% and 95% of that mean, rounded to at least 1 unit. Demo starts at a game target of 11 units.</p></div></details></section>
        </div>
        <section className="rules" aria-label="Game rules and data source"><details><summary>Fair calls, clear rules <span>Scoring & settlement</span></summary><div className="rule-grid details-content"><div><h3>Make a call. Make a dent.</h3><p>A correct prediction earns 100 points and deals 20 damage. Each additional consecutive win adds 10 bonus points, up to 50. A miss earns zero and resets your streak. Every fifth correct call defeats a 100-HP boss; the next boss arrives at full health.</p></div><div><h3>Count the work, exactly.</h3><p>One work unit is one accepted wheel-magnet passage. Live work is the difference between cumulative passage counts at the two boundaries: after the start, up to and including the end. Equality counts as AT/OVER.</p><p>The source must cover the full window. Missing passages, counter resets or no valid coverage within 120 seconds after the end void the round. Voids leave points, streak and boss health unchanged.</p></div><div><h3>Know the source.</h3><p>Hardware measurements come from the official <a href={API+'/status'} target="_blank" rel="noreferrer">status endpoint</a> and <a href={API+'/measurement/runs?limit=1'} target="_blank" rel="noreferrer">passage feed</a>. These are device-key evidence reported by the API, not Ethereum-certified settlement. This browser does not independently verify device signatures.</p><p><a href={DOCS} target="_blank" rel="noreferrer">Read the official API documentation ↗</a></p><p>Last status success: {source.lastSuccess?time(source.lastSuccess):'not yet'}. Last complete passage sync: {source.lastEvidenceSuccess?time(source.lastEvidenceSuccess):'not yet'}. Device observed: {source.measurement?time(source.measurement.observedAt):'not yet'}. Passage coverage through: {source.evidence.through?time(source.evidence.through):'not yet'}.</p></div></div></details></section>
        <div className="save-line"><span>Saved in this browser · {isDemo?'Demo':'Live'} progress · Scores are not tamper-proof.</span><button className="text-button" onClick={resetProgress}>Reset {mode} progress</button></div>
        <p className="action-notice" role="status">{notice}</p>
      </main>
      <footer><span>A small game for the Squeekchain community.</span><p>Independent, unofficial project. No betting, wallets, paid rewards or guaranteed Genesis eligibility. Points have no monetary value.</p><a href="https://squeek-wheel-oracle.netlify.app" target="_blank" rel="noreferrer">Inspired by the original prototype ↗</a></footer>
    </div>
    <dialog ref={dialog} aria-labelledby="help-title"><div className="dialog-top"><h2 id="help-title">A tiny guide to the Oracle</h2><button className="icon-button" aria-label="Close guide" onClick={()=>dialog.current?.close()}><Icon name="close"/></button></div><ol className="help-steps"><li><strong>Choose your world.</strong><p>Live uses a real hamster’s 60-second window. Demo is eight seconds of synthetic activity with its own score.</p></li><li><strong>Call UNDER or AT/OVER.</strong><p>Read the target and the baseline’s call. Lock your choice; the window begins three seconds later. The target never changes mid-round.</p></li><li><strong>Let the wheel decide.</strong><p>Valid passage evidence determines the result. Equality is AT/OVER. Unverifiable rounds are void with no penalty.</p></li><li><strong>Take down the Vacuum.</strong><p>Correct: 100 points, 20 damage. Streak: +10 per extra win, capped at +50. Five correct calls defeat each boss.</p></li></ol><p className="muted">Use Tab to move between controls, arrow keys in the history filter, and Enter or Space to activate buttons. Escape closes this guide.</p><button className="primary" onClick={()=>dialog.current?.close()}>Back to the wheel <Icon name="arrow"/></button></dialog>
  </>;
}
