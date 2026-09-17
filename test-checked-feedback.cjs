const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const {DatabaseSync}=require('node:sqlite');
const {chromium}=require('playwright');

class D1{
 constructor(){this.db=new DatabaseSync(':memory:');for(const file of fs.readdirSync(__dirname+'/drizzle').filter(x=>x.endsWith('.sql')).sort())this.db.exec(fs.readFileSync(__dirname+'/drizzle/'+file,'utf8'));}
 prepare(sql){return{bind:(...args)=>({first:async()=>this.db.prepare(sql).get(...args)||null,all:async()=>({results:this.db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(this.db.prepare(sql).run(...args).changes)}}),sql,args})};}
 async batch(items){this.db.exec('BEGIN');try{const results=items.map(x=>({meta:{changes:Number(this.db.prepare(x.sql).run(...x.args).changes)}}));this.db.exec('COMMIT');return results;}catch(error){this.db.exec('ROLLBACK');throw error;}}
}

const mockRTC=()=>{
 window.rtcLog={sends:[]};
 HTMLMediaElement.prototype.play=async()=>{};
 HTMLMediaElement.prototype.pause=()=>{};
 class Channel{
  constructor(){this.readyState='connecting';}
  close(){this.readyState='closed';}
  send(raw){const event=JSON.parse(raw);rtcLog.sends.push(event);if(event.type==='response.create'){this.emit({type:'response.created'});this.emit({type:'output_audio_buffer.started'});setTimeout(()=>{if(this.readyState!=='open')return;this.emit({type:'response.output_audio_transcript.done',transcript:'Mock spoken reply.'});this.emit({type:'output_audio_buffer.stopped'});},15);}}
  emit(event){this.onmessage?.({data:JSON.stringify(event)});}
 }
 window.RTCPeerConnection=class{
  addTransceiver(){}
  createDataChannel(){return this.channel=new Channel();}
  async createOffer(){return{sdp:'v=0\r\nmock-offer'};}
  async setLocalDescription(){}
  async setRemoteDescription(){this.channel.readyState='open';setTimeout(()=>this.channel.onopen?.(),0);}
  close(){this.channel?.close();}
 };
};

(async()=>{
 const mod=await import(pathToFileURL(__dirname+'/dist/server/index.js'));
 const worker=mod.default,realFetch=fetch,env={DB:new D1(),OPENAI_API_KEY:'mock-private-key',COURSE_ADMIN_EMAIL:'owner@example.com',COURSE_INITIAL_STUDENTS:'feedback@example.com'};
 global.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.openai.com/'))return realFetch(url,options);
  if(String(url).endsWith('/realtime/calls'))return new Response('v=0\r\nmock-answer',{headers:{location:'https://api.openai.com/v1/realtime/calls/rtc_feedback'}});
  if(String(url).endsWith('/hangup'))return new Response(null,{status:200});
  if(String(url).endsWith('/responses'))return Response.json({output_text:JSON.stringify({text:'Yes — that is correct. Continue to the next step.',assessment:'correct'})});
  throw Error('Unexpected provider path');
 };
 const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','feedback-learner');headers.set('oai-authenticated-user-email','feedback@example.com');const request=new Request('http://127.0.0.1:8998'+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(8998,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();await context.addInitScript(mockRTC);const page=await context.newPage();
  await page.goto('http://127.0.0.1:8998');await page.waitForFunction(()=>CourseSession.active);
  await page.locator('#learner-name').fill('Emma');await page.getByRole('button',{name:'Start AI 102',exact:true}).click();await page.waitForFunction(()=>EveRealtime.connected);
  await page.getByRole('button',{name:/Business helper/}).click();await page.getByRole('button',{name:'Save name & begin Mission 1 →',exact:true}).click();await page.getByRole('button',{name:'Watch AI handle a request →',exact:true}).click();await page.getByRole('button',{name:'Show what happens',exact:true}).click();await page.getByRole('button',{name:'Try it yourself →',exact:true}).click();
  await page.locator('.chapter-choices .choice').nth(1).click();await page.getByRole('button',{name:'Next: Make a prediction',exact:true}).click();
  await page.locator('#day1-answer-predict').fill('A vague first action.');
  await page.route('**/v1/teacher/respond',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'That is a useful start, but make the action more specific.',assessment:'not_yet'})}));
  await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
  await page.waitForFunction(()=>rtcLog.sends.filter(x=>x.type==='response.create').at(-1)?.response?.instructions?.includes('CHECKED FEEDBACK MODE'));
  const incorrect=await page.evaluate(()=>rtcLog.sends.filter(x=>x.type==='response.create').at(-1).response.instructions);
  assert.match(incorrect,/That is a useful start, but make the action more specific/);assert.match(incorrect,/already answered and the site already checked it/i);assert.doesNotMatch(incorrect,/Final interaction rule: Ask only the visible question/);assert.equal(await page.locator('#day1-next').isDisabled(),true);
  await page.unroute('**/v1/teacher/respond');await page.locator('#day1-answer-predict').fill('It can suggest one specific five-minute action.');
  await page.route('**/v1/teacher/realtime/context',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({detail:'Temporary voice failure'})}));
  await page.getByRole('button',{name:'Check with Eve',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('day1-next').disabled);await page.waitForFunction(()=>voiceSession.phase==='error');
  assert.match(await page.locator('#day1-feedback').innerText(),/Yes — that is correct/);
  await page.unroute('**/v1/teacher/realtime/context');await page.getByRole('button',{name:'Try again',exact:true}).click();
  await page.waitForFunction(()=>rtcLog.sends.filter(x=>x.type==='response.create').at(-1)?.response?.instructions?.includes('REVIEWED ANSWER MODE'));
  const retried=await page.evaluate(()=>rtcLog.sends.filter(x=>x.type==='response.create').at(-1).response.instructions);assert.match(retried,/Do not ask the learner to answer it again/);assert.doesNotMatch(retried,/Final interaction rule: Ask only the visible question/);
  await page.reload();await page.waitForFunction(()=>window.EveRealtime?.connected);await page.waitForFunction(()=>rtcLog.sends.filter(x=>x.type==='response.create').at(-1)?.response?.instructions?.includes('REVIEWED ANSWER MODE'));
  assert.equal(await page.locator('#day1-next').isDisabled(),false);
  console.log('PASS: actual written-answer controls produce checked-feedback speech without re-asking after incorrect or correct results; a voice failure preserves the checked result, Try again uses reviewed-answer mode, and reload resumes the saved checked state. OpenAI transport/audio mocked.');
  if(process.argv.includes('--live')){
   await page.evaluate(()=>EveRealtime.stop());await context.close();env.DB=new D1();env.OPENAI_API_KEY=fs.readFileSync(__dirname+'/gpu-service/api/.env','utf8').match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^[\'\"]|[\'\"]$/g,'');global.fetch=realFetch;
   const live=await browser.newContext();await live.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw Error('Checked-feedback voice requested a microphone.');};const Native=RTCPeerConnection;window.liveTranscripts=[];window.RTCPeerConnection=class extends Native{createDataChannel(...args){const dc=super.createDataChannel(...args);dc.addEventListener('message',event=>{const data=JSON.parse(event.data);if((data.type==='response.output_audio_transcript.done'||data.type==='response.audio_transcript.done')&&data.transcript)liveTranscripts.push(data.transcript);});return dc;}};});
   const livePage=await live.newPage();const waitReply=async action=>{const count=await livePage.evaluate(()=>project().guidance.eveHistory.filter(x=>x.role==='eve').length);await action();await livePage.waitForFunction(n=>project().guidance.eveHistory.filter(x=>x.role==='eve').length>n,count,{timeout:30000});};
   await livePage.goto('http://127.0.0.1:8998');await livePage.waitForFunction(()=>CourseSession.active);await livePage.locator('#learner-name').fill('Emma');await livePage.getByRole('button',{name:'Start AI 102',exact:true}).click();await livePage.waitForFunction(()=>liveTranscripts.length>0,{},{timeout:30000});
   await livePage.getByRole('button',{name:/Personal coach/}).click();await waitReply(()=>livePage.getByRole('button',{name:'Save name & begin Mission 1 →',exact:true}).click());await waitReply(()=>livePage.getByRole('button',{name:'Watch AI handle a request →',exact:true}).click());await waitReply(()=>livePage.getByRole('button',{name:'Show what happens',exact:true}).click());await waitReply(()=>livePage.getByRole('button',{name:'Try it yourself →',exact:true}).click());await livePage.locator('.chapter-choices .choice').nth(1).click();await waitReply(()=>livePage.getByRole('button',{name:'Next: Make a prediction',exact:true}).click());
   const checked='Yes — that’s a great prediction. You named a specific tiny action (five minutes), which is exactly the kind of first step a coach would suggest to make a big goal manageable.';await livePage.route('**/v1/teacher/respond',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:checked,assessment:'correct'})}));await livePage.locator('#day1-answer-predict').fill('Start with five minutes today.');const transcriptCount=await livePage.evaluate(()=>liveTranscripts.length);await livePage.getByRole('button',{name:'Check with Eve',exact:true}).click();await livePage.waitForFunction(n=>liveTranscripts.length>n,transcriptCount,{timeout:30000});const spoken=await livePage.evaluate(()=>liveTranscripts.at(-1));assert.match(spoken,/five minutes/i);assert.doesNotMatch(spoken,/[?？]/);assert.doesNotMatch(spoken,/\b(answer|tell me|what do you think|try again)\b/i);await livePage.evaluate(()=>EveRealtime.stop());await live.close();
   console.log('PASS: LIVE OpenAI voice spoke the checked positive feedback after the actual Check with Eve control without asking for the answer again. Browser audio device was not physically verified.');
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));global.fetch=realFetch;}
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
