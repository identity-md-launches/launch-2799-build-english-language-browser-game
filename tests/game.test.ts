import {test} from 'node:test';
import assert from 'node:assert/strict';
import {completeRound, emptyProgress, forecast, lockRound, makeDraft, newSave, parseSave, type Progress, type WindowResult} from '../src/domain';
const base=Date.UTC(2026,9,31,12);
const window=(work:number,end=base):WindowResult=>({start:end-60_000,end,work,startCount:100,endCount:100+work});
const play=(p:Progress,correct=true,actual=10)=>{
  const now=base+(p.wins+p.losses)*100_000;
  const draft=makeDraft('live',[window(10)],now,p.wins+p.losses);
  draft.target=10;
  const active=lockRound(draft,correct?'over':'under',now,'hardware-installation','counter-epoch');
  return completeRound({...p,active},{start:active.start,end:active.end,work:actual,startCount:100,endCount:100+actual},active.end);
};
test('equality settles AT/OVER and earns 100 points / 20 damage',()=>{
  const p=play(emptyProgress());assert.equal(p.score,100);assert.equal(p.bossHp,80);assert.equal(p.streak,1);assert.equal(p.history[0].result,'correct');
});
test('five correct calls defeat a boss, next boss starts at 100 HP',()=>{
  let p=emptyProgress();for(let i=0;i<5;i++)p=play(p);
  assert.equal(p.bosses,1);assert.equal(p.bossHp,100);assert.equal(p.score,600);assert.equal(p.wins,5);
  p=play(p);assert.equal(p.bossHp,80);assert.equal(p.score,750);
});
test('streak bonus caps at 50',()=>{
  let p=emptyProgress();for(let i=0;i<12;i++)p=play(p);
  assert.equal(p.history[0].bonus,50);assert.equal(p.history[0].points,150);assert.equal(p.score,1650);assert.equal(p.bosses,2);assert.equal(p.bossHp,60);
});
test('a miss awards no points and resets the streak without healing the boss',()=>{
  const p=play(play(emptyProgress()),false);assert.equal(p.score,100);assert.equal(p.streak,0);assert.equal(p.bossHp,80);assert.equal(p.losses,1);
  const after=play(p);assert.equal(after.score,200);assert.equal(after.history[0].bonus,0);
});
test('void preserves score, streak, damage, boss count and baseline stats',()=>{
  const p=play(emptyProgress());const active=lockRound(makeDraft('live',[],base+100_000,1),'under',base+100_000,'i','e');
  const result=completeRound({...p,active},null,active.end,'Unavailable evidence');
  for(const key of ['score','streak','bossHp','bosses','wins','losses','algorithmWins','algorithmRounds'] as const)assert.equal(result[key],p[key]);
  assert.equal(result.history[0].result,'void');assert.equal(result.history[0].points,0);
});
test('settlement is idempotent',()=>{const p=play(emptyProgress());assert.equal(completeRound(p,null,base),p);});
test('early, negative, wrong-boundary and inconsistent evidence cannot award a result',()=>{
  const active=lockRound(makeDraft('live',[],base,0),'over',base,'i','e');const p={...emptyProgress(),active};
  const evidence={start:active.start,end:active.end,work:10,startCount:100,endCount:110};
  assert.equal(completeRound(p,evidence,active.end-1),p);
  assert.equal(completeRound(p,{...evidence,start:active.start-1},active.end),p);
  assert.equal(completeRound(p,{...evidence,work:-1},active.end),p);
  assert.equal(completeRound(p,{...evidence,endCount:111},active.end),p);
});
test('forecast uses at most five completed windows of the same duration and no future observations',()=>{
  const samples=Array.from({length:7},(_,i)=>window(i,base-(6-i)*60_000));
  samples.push(window(99999,base+60_000));samples.push({...window(99999),start:base-8_000});
  const f=forecast(samples,60_000,base,4);assert.equal(f.mean,4);assert.equal(f.choice,'over');assert.equal(f.samples.length,5);
});
test('baseline abstains when there is no eligible history',()=>{const f=forecast([],60_000,base,1);assert.equal(f.choice,null);assert.equal(f.mean,null);});
test('round preserves target and forecast after locking, and starts in the future',()=>{
  const d=makeDraft('live',[window(10)],base,0);const r=lockRound(d,'under',base+1000,'i','e');
  assert.equal(r.target,11);assert.equal(r.start,r.lockedAt+3000);assert.equal(r.end-r.start,60_000);
  makeDraft('live',[window(999)],base+2000,1);assert.equal(r.target,11);assert.equal(r.forecast.mean,10);
});
test('reload restores completed scores and a locked pending round',()=>{
  const s=newSave();s.live=play(emptyProgress());s.live.active=lockRound(makeDraft('live',[window(10)],base+100_000,1),'over',base+100_000,'i','e');
  assert.deepEqual(parseSave(JSON.stringify(s)),s);
});
test('demo and live progress remain separate',()=>{const s=newSave();s.live=play(s.live);assert.equal(s.demo.score,0);assert.equal(s.demo.bossHp,100);});
test('corrupt / unsupported saves fail closed',()=>{
  for(const raw of ['{','null','{}',JSON.stringify({...newSave(),version:2}),JSON.stringify({...newSave(),live:{...emptyProgress(),score:-1}})])assert.equal(parseSave(raw),null);
});
test('history stays bounded while totals remain cumulative',()=>{let p=emptyProgress();for(let i=0;i<110;i++)p=play(p);assert.equal(p.history.length,100);assert.equal(p.wins,110);});
