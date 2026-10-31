import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendPage,emptyEvidence,evidenceFresh,measurementFresh,parseStatus,recentWindows,timestampNs,windowEvidence} from '../src/evidence';
const base=Date.UTC(2026,9,31,12), iso=(n:number)=>new Date(n).toISOString();
function segment(times:number[],extra:Record<string,unknown>={}){
 return {segmentId:'segment-1',continuityId:'continuity-1',discontinuity:true,startAt:iso(times[0]),endAt:iso(times.at(-1)!),workUnits:String(times.length),previousAt:null,provenance:'hardware',measurementEligible:true,
   passages:times.map(t=>({at:iso(t),offsetNs:((BigInt(t)-BigInt(times[0]))*1_000_000n).toString()})),...extra};
}
function page(items:unknown[],extra:Record<string,unknown>={}){
 return {schemaVersion:'measurement-runs.v1',installationId:'installation-1',authority:'pi-device-key',certifiedCoreWork:false,generatedAt:iso(base+120_000),coverageStartAt:iso(base-600_000),coverageThroughAt:iso(base+120_000),freshness:'fresh',items,nextCursor:'cursor-1',...extra};
}
function complete(items:unknown[]){const s=appendPage(emptyEvidence(),page(items),base+120_000);return appendPage(s,page([]),base+120_000);}
function status(extra:Record<string,unknown>={}){
 return {schemaVersion:1,installationId:'installation-1',generatedAt:iso(base),measurement:{freshness:'online',observedAt:iso(base-1000),receivedAt:iso(base-500),counterEpoch:'epoch-1',cumulativeWorkUnits:'12345',provenance:'hardware',coreStatus:'IDLE',rpmMilli:0,staleAfterSeconds:120,...extra}};
}
test('counts exact cumulative differences in (start, end], including equality at end',()=>{
 const s=complete([segment([base,base+1000,base+60_000,base+60_001])]);
 assert.deepEqual(windowEvidence(s,base,base+60_000),{start:base,end:base+60_000,work:2,startCount:1,endCount:3});
});
test('nanosecond timestamps preserve source precision',()=>{
 assert.equal(timestampNs('2026-10-31T12:00:00.123456789Z')-timestampNs('2026-10-31T12:00:00Z'),123456789n);
});
test('partial pagination never establishes coverage, even if the envelope claims it',()=>{
 const s=appendPage(emptyEvidence(),page([segment([base+1000])]),base+120_000);
 assert.equal(s.caughtUp,false);assert.equal(windowEvidence(s,base,base+60_000),null);
});
test('a covered idle window is a valid measured zero',()=>{
 const s=complete([segment([base-1000])]);assert.equal(windowEvidence(s,base,base+60_000)?.work,0);
});
test('missing end coverage never becomes zero activity',()=>{
 const s=complete([segment([base+1000])]);s.through=base+30_000;assert.equal(windowEvidence(s,base,base+60_000),null);
});
test('continuity breaks invalidate overlapping windows',()=>{
 const s=complete([segment([base-1000]),segment([base+30_000],{segmentId:'segment-2',continuityId:'continuity-2',discontinuity:true})]);
 assert.equal(windowEvidence(s,base,base+60_000),null);
});
test('missing segment links fail before a page is committed',()=>{
 assert.throws(()=>complete([segment([base-1000]),segment([base+30_000],{segmentId:'segment-2',discontinuity:false,previousAt:iso(base-2000)})]),/missing|reset/);
});
test('correct continuity links are accepted',()=>{
 const s=complete([segment([base-1000]),segment([base+30_000],{segmentId:'segment-2',discontinuity:false,previousAt:iso(base-1000)})]);assert.equal(windowEvidence(s,base,base+60_000)?.work,1);
});
test('non-hardware, ineligible and unsupported schema feeds are rejected',()=>{
 for(const extra of [{provenance:'simulated'},{provenance:'replay'},{measurementEligible:false}])assert.throws(()=>complete([segment([base],extra)]));
 assert.throws(()=>appendPage(emptyEvidence(),page([],{schemaVersion:'measurement-runs.v2'}),base+120_000));
});
test('mismatched counts and invalid passage timestamps are rejected',()=>{
 assert.throws(()=>complete([segment([base],{workUnits:'2'})]));
 const bad=segment([base]);bad.passages[0].at='invalid';assert.throws(()=>complete([bad]));
});
test('out-of-order and duplicate evidence cannot double count',()=>{
 assert.throws(()=>complete([segment([base,base-1])]));assert.throws(()=>complete([segment([base]),segment([base])]));
});
test('changing installation or stalled cursor fails closed',()=>{
 const s=appendPage(emptyEvidence(),page([segment([base])]),base+120_000);
 assert.throws(()=>appendPage(s,page([],{installationId:'installation-2'}),base+120_000));
 assert.throws(()=>appendPage(s,page([segment([base+1000],{segmentId:'segment-2'})]),base+120_000));
});
test('stale readings are not fresh and expire based on time as well as source flags',()=>{
 const m=parseStatus(status(),base);assert.equal(measurementFresh(m,base),true);assert.equal(measurementFresh(m,base+120_000),false);
 assert.equal(measurementFresh(parseStatus(status({freshness:'stale'}),base),base),false);
 const s=complete([segment([base])]);assert.equal(evidenceFresh(s,base+120_000),true);assert.equal(evidenceFresh(s,base+241_000),false);
});
test('counter faults, null measurements and non-hardware status cannot enable live play',()=>{
 assert.equal(measurementFresh(parseStatus(status({coreStatus:'COUNTER_FAULT'}),base),base),false);
 assert.throws(()=>parseStatus(status({provenance:'simulated'}),base));assert.throws(()=>parseStatus({...status(),measurement:null},base));
});
test('unsupported status schema and future source clocks fail closed',()=>{
 assert.throws(()=>parseStatus({...status(),schemaVersion:2},base));assert.throws(()=>parseStatus(status(),base-60_000));
});
test('recent baseline windows have identical duration and never use future coverage',()=>{
 const s=complete([segment([base-300_000,base-240_000,base-180_000,base-120_000,base-60_000,base+1000])]);
 const windows=recentWindows(s,base);assert.equal(windows.length,5);assert(windows.every(w=>w.end<=base&&w.end-w.start===60_000));
});
test('old passages are compacted to an exact cumulative anchor',()=>{
 const s=complete([segment([base-31*60_000,base+1000])]);assert.equal(s.anchor,1);assert.equal(s.points.length,1);assert.equal(windowEvidence(s,base,base+60_000)?.work,1);
});
test('stale and backwards coverage cannot settle a new window',()=>{
 const s=complete([segment([base])]);assert.throws(()=>appendPage(s,page([],{coverageThroughAt:iso(base+60_000)}),base+120_000));
 const stale=appendPage(s,page([],{freshness:'stale'}),base+120_000);assert.equal(evidenceFresh(stale,base+120_000),false);
});

test('uses documented absolute passage times even when unused offsets disagree',()=>{
 const item=segment([base+1000,base+2000]);item.passages[1].offsetNs='1000000100';
 assert.equal(windowEvidence(complete([item]),base,base+60_000)?.work,2);
});

test('a browser clock behind the source cannot lock a window already in the past',()=>{
 assert.throws(()=>parseStatus(status(),base-2000),/clocks/);
 assert.throws(()=>parseStatus(status(),base+15000),/clocks/);
});
