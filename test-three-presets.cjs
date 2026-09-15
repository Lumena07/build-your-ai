const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8999/**',route=>{
   const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://127.0.0.1:8999');
  await page.evaluate(()=>{
   window.templateRequests=[];
   window.BuildAICloud.teacherReply=async body=>{window.templateRequests.push(body);if(window.templateOffline)throw Error('Teacher offline for test');return {text:'Continue with your selected agent.',assessment:body.turn_kind==='answer'?'correct':'none'};};
   speakTurn=async()=>{voiceState('idle');};
  });
  const choices=[['tutor','Biology tutor'],['business','Business helper'],['coach','Personal coach']];
  for(const [id,title] of choices){
   await page.evaluate(()=>{
    cancelVoice();const p=defaultProject();p.guidance.learnerName='Emma';store.projects.push(p);store.active=p.id;store.page='intro';courseResuming=false;voiceSession.enabled=false;evePageVisit='';save();render();
   });
   assert.equal(await page.locator('main button.choice').count(),3);
   for(const removed of ['Study assistant','Aviation compliance assistant','Writing assistant'])assert.equal(await page.getByRole('button',{name:new RegExp(removed)}).count(),0);
   await page.evaluate(id=>{voiceSession.enabled=true;window.templateOffline=id==='coach';},id);
   await page.getByRole('button',{name:new RegExp(title)}).click();
   assert.equal(await page.evaluate(()=>project().preset),id);
   const payload=await page.evaluate(()=>evePayload(0,'Help me choose'));
   assert.deepEqual(payload.available_presets.map(p=>p.split(':')[0]),choices.map(p=>p[1]));
   assert.equal(payload.preset_title,title);
   if(id==='coach'){
    await page.locator('#eve-retry').getByRole('button',{name:'Try again'}).waitFor();
    assert.equal(await page.evaluate(()=>project().preset),'coach');
    await page.evaluate(()=>{window.templateOffline=false;});
    await page.locator('#eve-retry').getByRole('button',{name:'Try again'}).click();
    await page.waitForFunction(()=>voiceSession.phase==='idle');
   }
   await page.getByRole('button',{name:'Save my blueprint →'}).click();
   assert.equal(await page.evaluate(()=>store.page),'lab1');
   assert.equal(await page.evaluate(()=>evePayload(1,'Hello').preset_title),title);
   await page.locator('#day1-answer-ai').fill('No');
   await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
   await page.waitForFunction(()=>!document.getElementById('day1-next').disabled);
   await page.getByRole('button',{name:'Next: make a prediction'}).click();
   await page.locator('#day1-answer-predict').waitFor();
   const question=await page.evaluate(()=>evePayload(1,'Predict','answer').question_context);
   assert.equal(question,await page.evaluate(id=>presetPractice[id].question,id));
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).projects.find(p=>p.id===store.active));
   assert.equal(saved.preset,id);assert.equal(saved.guidance.learnerName,'Emma');
  }
  // Retired templates remain compatible with saved learner work, but not selectable.
  await page.evaluate(()=>{
   cancelVoice();voiceSession.enabled=false;const p=defaultProject(),old=presetCatalog.find(p=>p.id==='study');Object.assign(p,{preset:'study',name:'Saved Study Agent',purpose:old.purpose,samples:[...old.samples],completed:['intro'],examples:[{input:'Revise maths',output:'Practise one example.'}]});p.guidance.learnerName='Sam';store.projects.push(p);store.active=p.id;store.page='intro';save();render();
  });
  await page.reload();
  await page.getByRole('button',{name:'Resume with Eve'}).waitFor();
  await page.evaluate(()=>{speakTurn=async()=>{};window.BuildAICloud.teacherReply=async()=>{throw Error('Offline test');};});
  await page.getByRole('button',{name:'Resume with Eve'}).click();
  assert.equal(await page.locator('main button.choice').count(),3);
  assert.equal(await page.evaluate(()=>evePayload(0,'Hello').preset_title),'Study assistant');
  await page.getByRole('button',{name:'Next activity',exact:true}).click();
  await page.getByRole('button',{name:'Save my blueprint →'}).click();
  assert.equal(await page.evaluate(()=>store.page),'lab1');
  assert.equal(await page.evaluate(()=>project().preset),'study');
  assert.equal(await page.evaluate(()=>project().examples.length),1);
  assert.equal(await page.evaluate(()=>store.projects.length),5);
  assert.deepEqual(errors,[]);
  console.log('All three template controls, exact Eve choices, blueprint-to-Day 1 examples, offline retry, saved choices and retired-project resume passed (mocked Eve).');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
