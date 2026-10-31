import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import assert from 'node:assert/strict';

// API responses in this suite are explicit fixtures, never production fallback data.
const out=resolve(process.env.CHECK_OUTPUT??'test/scratch/interactions');
await mkdir(out,{recursive:true});
const root=resolve('dist');
const server=createServer(async(req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/preview\//,'');
  const file=resolve(root,relative||'index.html');
  if(!file.startsWith(root+'/')){res.writeHead(404);res.end();return;}
  try{const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream');res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/preview/`;
const results=[];
const record=(name,details)=>{results.push({name,passed:true,...details});console.log('PASS',name);};
const base=Date.UTC(2026,9,31,12,0,0),iso=t=>new Date(t).toISOString(),key='squeek-wheel-oracle:v1';
async function advance(page,ms){for(let left=ms;left>0;left-=1000){await page.clock.runFor(Math.min(1000,left));await new Promise(r=>setTimeout(r,20));}}
async function targetValue(page){for(let i=0;i<20;i++){const n=parseInt(await page.locator('.target-number').innerText(),10);if(Number.isFinite(n))return n;await advance(page,250);}throw new Error('Target did not become available');}
async function fixture(page){
  const state={offline:false,stale:false,epoch:'fixture-epoch-1',gap:false,rateLimit:false,calls:0};
  const times=Array.from({length:240},(_,i)=>base-6*60_000+(i+1)*6000);
  await page.clock.install({time:new Date(base)});
  await page.route('https://api.squeekchain.com/**',async route=>{
    state.calls++;
    if(state.offline){await route.fulfill({status:503,body:'{"error":"fixture_unavailable"}',headers:{'Retry-After':'10','Content-Type':'application/json'}});return;}
    if(state.rateLimit){await route.fulfill({status:429,body:'{"error":"rate_limited"}',headers:{'Retry-After':'30','Content-Type':'application/json'}});return;}
    const now=await page.evaluate(()=>Date.now()),endpoint=new URL(route.request().url()),at=now;
    let data;
    if(endpoint.pathname.endsWith('/status'))data={schemaVersion:1,installationId:'fixture-hardware',generatedAt:iso(now),measurement:{freshness:state.stale?'stale':'online',observedAt:iso(state.stale?now-180_000:at),receivedAt:iso(state.stale?now-180_000:at),counterEpoch:state.epoch,cumulativeWorkUnits:String(times.filter(t=>t<=now).length),provenance:'hardware',coreStatus:'ACTIVE',rpmMilli:10000,staleAfterSeconds:120}};
    else{
      const offset=Number(endpoint.searchParams.get('cursor')?.replace('fixture-','')??0),available=times.filter(t=>t<=at),passages=available.slice(offset,offset+100);
      const items=passages.length?[{segmentId:'fixture-segment-'+offset,continuityId:state.gap?'fixture-broken':'fixture-continuity',discontinuity:offset===0||state.gap,startAt:iso(passages[0]),endAt:iso(passages.at(-1)),previousAt:offset?iso(available[offset-1]):null,workUnits:String(passages.length),provenance:'hardware',measurementEligible:true,passages:passages.map(t=>({at:iso(t),offsetNs:String((t-passages[0])*1_000_000)}))}]:[];
      data={schemaVersion:'measurement-runs.v1',installationId:'fixture-hardware',authority:'pi-device-key',certifiedCoreWork:false,generatedAt:iso(now),coverageStartAt:iso(base-6*60_000),coverageThroughAt:iso(at),freshness:state.stale?'stale':'fresh',items,nextCursor:'fixture-'+(offset+passages.length)};
    }
    await route.fulfill({json:data});
  });
  return state;
}
const browsers=[];
try{
  for(const type of [chromium,webkit]){
    let browser;
    try{browser=await type.launch({headless:true});browsers.push(browser);}
    catch(e){results.push({name:`${type.name()} runtime`,passed:false,limitation:String(e).slice(0,1500)});console.log('UNAVAILABLE',type.name(),String(e).slice(0,300));process.exitCode=1;continue;}
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=5;return array;}return original(array);};});
    await fixture(page);await page.goto(url);await advance(page,2000);
    assert.equal(await page.locator('.feed-state').innerText(),'LIVE');assert.equal(await page.locator('.target-number').innerText(),'11 units');
    await page.getByRole('button',{name:'Try demo 8s'}).click();
    for(let i=0;i<6;i++){
      if(i)await page.getByRole('button',{name:'Play next round'}).click();
      const target=await targetValue(page),choice=9>=target?'AT/OVER':'UNDER';
      await page.getByRole('button',{name:new RegExp(choice==='UNDER'?'^UNDER':'^AT/OVER')}).click();
      await page.getByRole('button',{name:'Lock '+choice,exact:true}).focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('.choice:disabled').count(),2);
      assert.match(await page.locator('.reactor-readings > div:first-child strong').innerText(),/—/);
      const pending=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
      assert.equal(pending.demo.active.target,target);assert(pending.demo.active.forecast.samples.every(w=>w.end<=pending.demo.active.preparedAt));
      if(i===0){await advance(page,4000);await page.reload();await advance(page,8000);}else await advance(page,12000);
      assert.equal(await page.getByRole('heading',{name:'Good call.'}).count(),1);
    }
    let saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.equal(saved.demo.score,750);assert.equal(saved.demo.bosses,1);assert.equal(saved.demo.bossHp,80);assert.equal(saved.demo.streak,6);assert.equal(saved.live.score,0);
    record(`${type.name()}: six wins, streak cap, boss replacement, keyboard lock and pending-round reload`,{score:saved.demo.score});
    await page.getByRole('button',{name:'Play next round'}).click();
    const target=await targetValue(page),miss=9>=target?'UNDER':'AT/OVER';
    await page.getByRole('button',{name:new RegExp(miss==='UNDER'?'^UNDER':'^AT/OVER')}).click();await page.getByRole('button',{name:'Lock '+miss,exact:true}).click();await advance(page,12000);
    saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(saved.demo.score,750);assert.equal(saved.demo.streak,0);assert.equal(saved.demo.bossHp,80);
    await page.reload();assert.equal((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).demo.score,750);
    record(`${type.name()}: missed prediction and completed-progress reload`);
    await page.getByRole('button',{name:'How to play',exact:true}).click();assert.equal(await page.locator('dialog[open]').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('.help-button').evaluate(el=>el===document.activeElement),true);
    await page.locator('select').selectOption('incorrect');assert.equal(await page.locator('.history-list li').count(),1);await page.locator('select').selectOption('all');
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();const download=await downloadPromise,exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(exported.progress.demo.score,750);assert.equal(exported.progress.live.score,0);
    record(`${type.name()}: guide focus return, history filter and JSON download`);
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:join(out,`${type.name()}-${width}.png`),fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Play next round'}).click();await page.getByRole('button',{name:/^UNDER/}).click();await page.evaluate(()=>scrollTo(0,0));
    const box=await page.getByRole('button',{name:'Lock UNDER',exact:true}).boundingBox();assert(box.y+box.height<=844,`main action bottom ${box.y+box.height}`);
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    await writeFile(join(out,`${type.name()}-axe.json`),JSON.stringify(axe.violations,null,2));assert.equal(axe.violations.length,0,JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
    assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations===Infinity&&a.playState==='running').length),0);assert.equal(errors.length,0,errors.join('\n'));
    record(`${type.name()}: 320/390/768/1440 reflow, first-screen action, reduced motion, axe and no script errors`,{primaryActionBottom:box.y+box.height});
    await context.close();
    const liveContext=await browser.newContext({viewport:{width:1440,height:1000}}),live=await liveContext.newPage(),feed=await fixture(live);
    await live.goto(url);await advance(live,2000);await live.getByRole('button',{name:/^UNDER/}).click();await live.getByRole('button',{name:'Lock UNDER',exact:true}).click();
    const locked=await live.evaluate(k=>JSON.parse(localStorage.getItem(k)).live.active,key);await advance(live,75000);
    let lp=await live.evaluate(k=>JSON.parse(localStorage.getItem(k)).live,key);
    assert.equal(lp.history[0].actual,10);assert.equal(lp.history[0].result,'correct');assert.equal(lp.score,100);assert.equal(lp.bossHp,80);assert.equal(lp.history[0].target,locked.target);assert.equal(lp.history[0].evidence.endCount-lp.history[0].evidence.startCount,10);
    record(`${type.name()}: live fixture locks future window and settles exact cumulative difference`);
    await live.getByRole('button',{name:'Play next round'}).click();await live.getByRole('button',{name:/^UNDER/}).click();await live.getByRole('button',{name:'Lock UNDER',exact:true}).click();feed.offline=true;await advance(live,195000);
    lp=await live.evaluate(k=>JSON.parse(localStorage.getItem(k)).live,key);assert.equal(lp.history[0].result,'void');assert.equal(lp.score,100);assert.equal(lp.streak,1);assert.equal(lp.bossHp,80);assert.equal(await live.locator('.feed-state').innerText(),'OFFLINE');
    record(`${type.name()}: HTTP 503 during live round voids after grace with no penalty`);
    feed.offline=false;feed.stale=true;await advance(live,25000);assert.equal(await live.locator('.feed-state').innerText(),'STALE');
    await live.getByRole('button',{name:'Play next round'}).click();await live.getByRole('button',{name:/^UNDER/}).click();assert.equal(await live.locator('.prediction .primary').isDisabled(),true);
    record(`${type.name()}: stale source disables new live rounds`);
    feed.stale=false;await advance(live,25000);await live.getByRole('button',{name:'Lock UNDER',exact:true}).click();feed.epoch='fixture-epoch-2';await advance(live,15000);
    lp=await live.evaluate(k=>JSON.parse(localStorage.getItem(k)).live,key);assert.equal(lp.history[0].result,'void');assert.match(lp.history[0].reason,/counter/);assert.equal(lp.score,100);
    record(`${type.name()}: counter-epoch change explicitly voids active round`);
    await liveContext.close();await browser.close();
  }
}catch(e){results.push({name:'interaction suite',passed:false,error:String(e),stack:e.stack});console.error(e);process.exitCode=1;}
finally{await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));for(const browser of browsers)await browser.close();await new Promise(r=>server.close(r));}
