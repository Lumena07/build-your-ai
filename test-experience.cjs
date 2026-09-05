const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:8999/**',async route=>{
  const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
  if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
  await route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('http://127.0.0.1:8999');
 await page.evaluate(()=>{project().guidance.learnerName='Emma';project().preset='business';project().name='My business AI';project().purpose=presets[2].purpose;project().samples=[...presets[2].samples];save();render();});
 // One visible activity; picking a preset reveals setup.
 assert.equal(await page.locator('main > .card:visible:not(#eve-debug)').count(),2); // learning goal plus preset card
 await page.getByRole('button',{name:/Business helper Help/}).click();
 await page.locator('#name').fill('Business assistant');
 await page.getByRole('button',{name:'Save my blueprint →'}).click();
 assert.match(await page.locator('main').innerText(),/Artificial intelligence/);
 await page.getByRole('button',{name:'See a sample answer'}).click();
 assert.match(await page.locator('main').innerText(),/difference is 20/);
 await page.getByRole('button',{name:'What should I check?'}).click();
 await page.getByRole('button',{name:'Try a small task'}).click();
 await page.getByRole('button',{name:'Use a fluent answer as evidence that it is correct',exact:true}).click();
 assert.match(await page.locator('#detail-feedback').innerText(),/still be wrong/);
 await page.getByRole('button',{name:'Use the answer as a starting point and check important claims',exact:true}).click();
 await page.getByRole('button',{name:'Check what I learned'}).click();
 await page.getByRole('button',{name:'Trust every answer',exact:true}).click();
 assert.match(await page.locator('#check-feedback').innerText(),/Try the other/);
 assert.equal(await page.evaluate(()=>store.page),'lab1');
 await page.getByRole('button',{name:'Check important facts',exact:true}).click();
 assert.equal(await page.evaluate(()=>store.page),'lab2');
 // Resume preserves page and work; restart targets just the active learner.
 await page.reload();await page.getByRole('button',{name:'Resume with Eve'}).waitFor();
 await page.evaluate(()=>{voiceSession.enabled=false;window.BuildAICloud.teacherReply=async()=>({text:'Test guidance'});window.BuildAICloud.teacherSpeech=async()=>{throw Error('Test audio offline');};});
 await page.getByRole('button',{name:'Resume with Eve'}).click();
 await page.getByRole('button',{name:'Try again',exact:true}).first().waitFor();
 assert.equal(await page.evaluate(()=>store.page),'lab2');
 await page.evaluate(()=>{voiceSession.enabled=false;cancelVoice();const other=defaultProject();other.name='Other learner';store.projects.push(other);save();});
 page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Restart this learner'}).click();
 await page.getByRole('button',{name:'Start AI 102',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>store.projects.some(p=>p.name==='Other learner')),true);
 assert.equal(await page.evaluate(()=>project().guidance.learnerName),'');
 // Moving between activities preserves written work.
 await page.evaluate(()=>{project().guidance.learnerName='Emma';project().preset='business';store.page='lab4';render();});
 await page.getByRole('button',{name:'Next activity',exact:true}).click();
 await page.locator('#behavior').fill('Use two short sentences and show the cost.');
 await page.getByRole('button',{name:'Next activity',exact:true}).click();
 await page.getByRole('button',{name:'Previous activity',exact:true}).click();
 assert.equal(await page.locator('#behavior').inputValue(),'Use two short sentences and show the cost.');
 // Late replies cannot replace the current reply.
 await page.evaluate(async()=>{
  voiceSession.enabled=true;let finish;
  window.BuildAICloud.teacherReply=()=>new Promise(resolve=>{finish=resolve;});
  const task=runVoice(1,'Old turn');cancelVoice();finish({text:'Stale reply'});await task;
  if(eveDebug.reply==='Stale reply')throw Error('Stale reply accepted');
  voiceSession.enabled=false;
 });
 // Three distinct launch checks persist before completion.
 await page.evaluate(()=>{const p=project();p.guidance.learnerName='Emma';p.preset='business';p.model={name:'Practice',version:1};p.completed=['intro'];store.page='lab7';render();});
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'Try this question',exact:true}).click();
  await page.getByRole('button',{name:'I checked this answer',exact:true}).click();
 }
 await page.getByRole('button',{name:'Finish and save my assistant'}).click();
 await page.getByRole('button',{name:'Admit the limit and ask for a reliable source'}).click();
 assert.equal(await page.evaluate(()=>store.page),'dashboard');
 assert.deepEqual(errors,[]);
 await browser.close();console.log('Beginner journey, misconception retry, resume, isolated reset, voice failure, stale turn and launch tests passed.');
})().catch(e=>{console.error(e);process.exit(1);});
