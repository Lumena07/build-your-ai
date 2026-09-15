const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const base='http://127.0.0.1:8998',identity='oai-authenticated-user-id';
class TestDB{
 constructor(){this.counts=new Map();}
 prepare(sql){assert.match(sql,/INSERT INTO eve_usage/);return {bind:(id,max)=>({id,max})};}
 async batch(items){return items.map(({id,max})=>{const old=this.counts.get(id)||0,changed=old<max;if(changed)this.counts.set(id,old+1);return {meta:{changes:changed?1:0}};});}
}
(async()=>{
 const worker=(await import(pathToFileURL(__dirname+'/dist/server/index.js'))).default,realFetch=global.fetch;
 let providerCalls=0,providerOffline=false;
 const env={OPENAI_API_KEY:'mock-private-server-key',DB:new TestDB()};
 global.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.openai.com/'))return realFetch(url,options);
  providerCalls++;if(providerOffline)return new Response('mock provider failure',{status:500});
  if(String(url).endsWith('/responses')){const input=JSON.parse(options.body);assert.equal(input.store,false);assert.match(input.instructions,/CURRENT|MISSION|Mission|LESSON/);return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({text:'Your agent can help with its chosen job. Let us explore one useful example.',assessment:'none'})}]}]});}
  if(String(url).endsWith('/speech'))return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});
  return Response.json({text:'Tell me more about my agent.'});
 };
 const body={lesson:'Mission 1 — Meet AI',lesson_summary:'Explain what AI does and why answers need checking.',learner_message:'What does AI do?',turn_kind:'conversation',has_greeted:true,available_presets:['Biology tutor','Study assistant','Business helper'],preset_examples:['Why do plants need sunlight?']};
 const request=(path,options={})=>new Request(base+path,options);
 const post=(path,data=body,headers={})=>request(path,{method:'POST',headers:{[identity]:'alice','content-type':'application/json',...headers},body:JSON.stringify(data)});
 let result=await worker.fetch(request('/'),env);assert.equal(result.status,302);assert.match(result.headers.get('location'),/signin-with-chatgpt/);
 result=await worker.fetch(post('/v1/teacher/respond',body,{[identity]:''}),env);assert.equal(result.status,401);assert.equal(providerCalls,0);
 result=await worker.fetch(post('/v1/teacher/respond',body,{origin:'https://untrusted.example'}),env);assert.equal(result.status,403);assert.equal(providerCalls,0);
 result=await worker.fetch(request('/gpu-service/api/.env',{headers:{[identity]:'alice'}}),env);assert.equal(result.status,404);
 result=await worker.fetch(post('/v1/teacher/respond',body,{'content-length':'3100001'}),env);assert.equal(result.status,413);
 result=await worker.fetch(post('/v1/teacher/respond',{...body,learner_message:'x'.repeat(3_100_001)}),env);assert.equal(result.status,413);
 result=await worker.fetch(post('/v1/teacher/respond',{...body,available_presets:'incorrect array'}),env);assert.equal(result.status,400);
 result=await worker.fetch(post('/v1/teacher/respond'),env);assert.equal(result.status,200);assert.match((await result.json()).text,/chosen job/);
 providerOffline=true;result=await worker.fetch(post('/v1/teacher/respond'),env);assert.equal(result.status,502);assert.doesNotMatch(await result.text(),/mock provider failure|mock-private-server-key/);providerOffline=false;
 const limited={...env,DB:new TestDB()};for(let i=0;i<20;i++)assert.equal((await worker.fetch(post('/v1/teacher/speech',{text:'One small idea.'}),limited)).status,200);assert.equal((await worker.fetch(post('/v1/teacher/speech',{text:'One small idea.'}),limited)).status,429);
 assert.equal((await worker.fetch(post('/v1/teacher/respond'),{DB:new TestDB()})).status,503);
 const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers(req.headers),who=(req.headers.cookie||'').match(/testStudent=([^;]+)/)?.[1];headers.delete(identity);if(who)headers.set(identity,who);const options={method:req.method,headers};if(!['GET','HEAD'].includes(req.method))options.body=Buffer.concat(chunks);const response=await worker.fetch(request(req.url,options),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Test server error');}});
 await new Promise(resolve=>server.listen(8998,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();await context.addCookies([{name:'testStudent',value:'alice',url:base}]);const page=await context.newPage();await page.goto(base);
  await page.evaluate(()=>{unlockEveAudio=()=>({state:'running',resume:async()=>{},decodeAudioData:async()=>({}),destination:{},createBufferSource(){return {connect(){},stop(){},start(){setTimeout(()=>this.onended?.(),0);}};}});});
  assert.equal(await page.evaluate(()=>BUILD_AI_CONFIG.apiBaseUrl),base);assert.equal(await page.evaluate(()=>KEY),'ai102-v1:alice');
  await page.getByRole('button',{name:'Start AI 102',exact:true}).click();assert.match(await page.locator('#learner-name-error').innerText(),/Please type/);
  await page.locator('#learner-name').fill('Alice');await page.getByRole('button',{name:'Start AI 102',exact:true}).click();await page.getByRole('heading',{name:'What would you like your agent to help with?'}).waitFor();await page.waitForFunction(()=>voiceSession.phase==='idle');
  await page.getByRole('button',{name:/Business helper/}).click();await page.getByRole('button',{name:'Save name & begin Mission 1 →',exact:true}).click();assert.equal(await page.evaluate(()=>store.page),'lab1');
  providerOffline=true;await page.getByRole('button',{name:'Watch AI handle a request →',exact:true}).click();await page.locator('#eve-retry').getByRole('button',{name:'Try again',exact:true}).waitFor();assert.equal(await page.evaluate(()=>store.page),'lab1');providerOffline=false;await page.locator('#eve-retry').getByRole('button',{name:'Try again',exact:true}).click();await page.waitForFunction(()=>voiceSession.phase==='idle');
  await page.reload();assert.match(await page.locator('main').innerText(),/Welcome back, Alice/);
  await context.addCookies([{name:'testStudent',value:'bob',url:base}]);await page.reload();assert.equal(await page.evaluate(()=>KEY),'ai102-v1:bob');assert.equal(await page.locator('#learner-name').inputValue(),'');
  await page.locator('#learner-name').fill('Bob');await page.getByRole('button',{name:'Start AI 102',exact:true}).click();await page.getByRole('heading',{name:'What would you like your agent to help with?'}).waitFor();
  await context.addCookies([{name:'testStudent',value:'alice',url:base}]);await page.reload();assert.match(await page.locator('main').innerText(),/Welcome back, Alice/);assert.equal(await page.evaluate(()=>store.page),'lab1');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Restart this learner',exact:true}).click();assert.equal(await page.evaluate(()=>project().guidance.learnerName),'Alice');
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Restart this learner',exact:true}).click();assert.equal(await page.locator('#learner-name').inputValue(),'');await page.reload();assert.equal(await page.evaluate(()=>store.page),'intro');
  await context.addCookies([{name:'testStudent',value:'bob',url:base}]);await page.reload();assert.match(await page.locator('main').innerText(),/Welcome back, Bob/);
  console.log('PASS: worker authentication gates, origin protection, asset/secret isolation, actual upload limit, invalid context, redacted provider failure, usage limit. Actual browser name/preset/mission controls, failed Eve + Try again, saved reload and isolated Alice/Bob progress passed. OpenAI, sign-in identities, D1 and audio device mocked.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));global.fetch=realFetch;}
 if(process.argv.includes('--live')){
  const privateEnv=fs.readFileSync(__dirname+'/gpu-service/api/.env','utf8'),key=privateEnv.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');assert.ok(key,'Approved existing key is present');
  const live={OPENAI_API_KEY:key,DB:new TestDB()};let response=await worker.fetch(post('/v1/teacher/respond'),live);assert.equal(response.status,200,'Live Eve response must succeed');const reply=await response.json();assert.ok(reply.text);assert.doesNotMatch(reply.text,/^(Hi|Hello|Welcome)\b/i);
  response=await worker.fetch(post('/v1/teacher/speech',{text:reply.text}),live);assert.equal(response.status,200,'Live speech must succeed');const speech=await response.json();assert.ok(Buffer.from(speech.audio_base64,'base64').length>1000);console.log('PASS: LIVE OpenAI teaching response and LIVE generated speech through the new online worker. D1/identity mocked; physical speaker and Alice’s real invitation acceptance not tested.');
 }
})().catch(error=>{console.error(error.message);process.exit(1);});
