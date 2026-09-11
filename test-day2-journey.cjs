const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const live=process.argv.includes('--live');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const requests=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8999/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.route('http://127.0.0.1:8787/v1/teacher/**',async route=>{
   if(!route.request().url().endsWith('/respond'))return route.fulfill({json:{audio_base64:''}});
   const body=route.request().postDataJSON();requests.push(body);
   if(live){
    const response=await fetch('http://127.0.0.1:8787/v1/teacher/respond',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    return route.fulfill({status:response.status,json:await response.json()});
   }
   const answer=body.learner_message.toLowerCase();
   const assessment=body.turn_kind==='answer'?(answer.startsWith('yes')?'not_yet':'correct'):'none';
   return route.fulfill({json:{text:assessment==='not_yet'?'Not quite. A token can be punctuation or part of a word.':assessment==='correct'?'Yes. A token can be a whole word, part of a word, or punctuation.':'Day 1 showed that AI uses patterns to answer. Today, tokens are the text pieces it processes. Reveal the pieces in your preset question.',assessment}});
  });
  await page.goto('http://127.0.0.1:8999');
  await page.evaluate(()=>{
   const p=project();p.guidance.learnerName='Anna';p.guidance.day2Step=1;p.guidance.day2Discoveries=[];p.preset='business';p.languages='English';p.completed=['intro','lab1'];p.samples=['My item costs 80 and I sell it for 100. What is my profit?',''];
   voiceSession.enabled=true;courseResuming=false;playLiveEve=async()=>{};evePageVisit='';save();go('lab2');
  });
  await page.getByRole('heading',{name:'From answers to text pieces'}).waitFor();
  assert.match(await page.locator('main').innerText(),/Yesterday you learned that AI uses patterns/);
  assert.equal(await page.getByRole('button',{name:'Reveal the token pieces'}).count(),1);
  assert.equal(await page.locator('textarea').count(),0,'Part 1 showed an unrelated input');
  await page.getByRole('button',{name:'Reveal the token pieces'}).click();
  await page.getByRole('heading',{name:'Token detective',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Next: try the token lab'}).isDisabled(),true);
  for(const name of [/Whole word/,/Word part/,/Punctuation/])await page.getByRole('button',{name}).click();
  assert.match(await page.locator('.token-clue').innerText(),/3 of 3/);
  assert.equal(await page.getByRole('button',{name:'Next: try the token lab'}).isDisabled(),false);

  await page.reload();
  await page.getByRole('button',{name:'Resume with Eve'}).click();
  await page.getByRole('heading',{name:'Token detective',exact:true}).waitFor();
  assert.match(await page.locator('.token-clue').innerText(),/3 of 3/,'Token discoveries were not restored');
  await page.getByRole('button',{name:'Next: try the token lab'}).click();
  const experiment=page.locator('#token-text'),next=page.locator('#day2-experiment-next');
  assert.equal(await next.isDisabled(),true);
  const starting=await experiment.inputValue();await experiment.fill(starting+' Please!');
  assert.equal(await next.isDisabled(),false);
  assert.match(await page.locator('#token-count').innerText(),/illustrated pieces/);
  await next.dispatchEvent('click');
  assert.equal(await page.evaluate(()=>project().guidance.day2Step),4,'Experiment did not advance to Part 4');
  await page.getByRole('heading',{name:'Why the pieces matter'}).waitFor();
  assert.equal(await page.locator('textarea').count(),1,'Part 4 should show one answer box');
  assert.equal(await page.locator('#day2-next').isDisabled(),true);
  const active=await page.evaluate(()=>evePayload(2,'Check this','answer'));
  assert.equal(active.current_question,'Is every token a whole word? Explain your answer.');
  assert.equal(active.previous_takeaway,'','Day 1 recap should not repeat on an answer turn');

  await page.locator('#day2-answer').fill('Yes, every token is a whole word.');
  await page.locator('#day2-check').click();
  await page.waitForFunction(()=>document.getElementById('day2-feedback')?.textContent!=='Eve is checking your answer…');
  assert.match(await page.locator('#day2-feedback').innerText(),/Eve: Not quite/);
  assert.equal(await page.locator('#day2-next').isDisabled(),true);
  await page.locator('#day2-answer').fill('No. A token can be punctuation or part of a word.');
  await page.evaluate(()=>{window.savedTeacherReply=window.BuildAICloud.teacherReply;window.BuildAICloud.teacherReply=async()=>{throw Error('offline');};});
  await page.locator('#day2-check').click();
  await page.getByText(/Eve could not check your answer/).waitFor();
  assert.equal(await page.locator('#day2-answer').inputValue(),'No. A token can be punctuation or part of a word.');
  assert.equal(await page.locator('#day2-next').isDisabled(),true);
  await page.evaluate(()=>{window.BuildAICloud.teacherReply=window.savedTeacherReply;});
  await page.locator('#day2-check').click();
  await page.waitForFunction(()=>document.getElementById('day2-feedback')?.textContent!=='Eve is checking your answer…');
  assert.match(await page.locator('#day2-feedback').innerText(),/Eve: Yes/);
  assert.equal(await page.locator('#day2-next').isDisabled(),false);
  await page.locator('#day2-next').click();
  await page.waitForFunction(()=>store.page==='lab3');
  assert.equal(await page.evaluate(()=>project().completed.includes('lab2')),true);
  assert.equal((await page.evaluate(()=>project().samples[1])).endsWith('Please!'),true,'Experiment sentence was not saved');
  if(!live){
   assert.ok(requests.some(r=>r.previous_takeaway&&r.lesson_connection),'Opening did not send the Day 1 connection');
   const tokenRequests=requests.filter(r=>r.lesson==='Tokens');
   assert.ok(tokenRequests.every(r=>!r.previous_takeaway||/moved from Day 1 to Day 2/i.test(r.learner_message)),`Day 1 recap was sent for a later Day 2 activity: ${tokenRequests.filter(r=>r.previous_takeaway).map(r=>r.learner_message).join(' | ')}`);
  }
  assert.deepEqual(errors,[]);
  console.log(`Day 2 four-part token journey, saved discoveries, failure retry, answer gate and navigation passed (${live?'live Eve':'mocked Eve'}).`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
