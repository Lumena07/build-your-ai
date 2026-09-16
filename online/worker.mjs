import assets from './assets.js';
import prompt from './instructions.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(status,detail)=>{throw Object.assign(new Error(detail),{status});};
const encoded=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const greetings=/^(hi\b|hello\b|hey\b|welcome\b|nice to meet you\b|my name is eve\b|i am eve\b|i'm eve\b)/i;
const sessionCookie='__Host-ai102_session';
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const cookie=request=>(request.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-ai102_session=([a-f0-9-]{36,80})(?:;|$)/)?.[1]||'';
async function currentSession(request,env,user){
 if(!env.DB)fail(503,'Student access is temporarily unavailable.');
 const token=cookie(request);if(!token)fail(409,'Start your course session to continue.');
 const row=await env.DB.prepare('SELECT * FROM course_sessions WHERE user_id=?').bind(user).first();
 if(!row||row.token_hash!==await hash(token))fail(409,'Your course is open on another device.');
 return row;
}
async function hangup(env,id){
 if(!id||id.startsWith('pending:'))return;
 const r=await fetch('https://api.openai.com/v1/realtime/calls/'+encodeURIComponent(id)+'/hangup',{method:'POST',headers:{authorization:'Bearer '+env.OPENAI_API_KEY},signal:AbortSignal.timeout(10000)});
 if(!r.ok&&r.status!==404&&r.status!==410)fail(503,'Eve could not close the previous connection. Please try again.');
}
async function startSession(request,env,user){
 if(!env.DB)fail(503,'Student access is temporarily unavailable.');
 const raw=await request.text();if(raw.length>1024)fail(413,'Session request is too large.');let body;try{body=JSON.parse(raw);}catch{fail(400,'Invalid session request.');}if(!body||typeof body!=='object')fail(400,'Invalid session request.');
 const old=await env.DB.prepare('SELECT * FROM course_sessions WHERE user_id=?').bind(user).first(),existing=cookie(request);
 if(existing&&old?.token_hash===await hash(existing)){
  // A reload or another tab must never terminate speech that is still playing elsewhere.
  await env.DB.prepare('UPDATE course_sessions SET seen_at=? WHERE user_id=? AND token_hash=?').bind(Date.now(),user,old.token_hash).run();
  return json({active:true});
 }
 if(old&&body.takeover!==true)fail(409,'Your course is open on another device.');
 const token=crypto.randomUUID()+crypto.randomUUID(),digest=await hash(token);
 // Replace the lease atomically, retaining the old call until it is closed.
 const claimed=await env.DB.prepare('INSERT INTO course_sessions (user_id,token_hash,seen_at,call_id) VALUES (?,?,?,NULL) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,seen_at=excluded.seen_at RETURNING call_id').bind(user,digest,Date.now()).first();
 await hangup(env,claimed?.call_id);
 await env.DB.prepare('UPDATE course_sessions SET call_id=NULL WHERE user_id=? AND token_hash=?').bind(user,digest).run();
 const response=json({active:true});response.headers.set('set-cookie',sessionCookie+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400');return response;
}
export function realtimeContext(body){
 teachingBody(body);
 const instructions=teachingPrompt(body).replace(/OUTPUT CONTRACT[\s\S]*?(?=TURN:)/,'LIVE VOICE\nSpeak naturally and complete the full CURRENT PAGE and CURRENT STAGE teaching step before stopping. For a lesson explanation, use 4–6 connected sentences (roughly 70–120 words). Never stop after an opening phrase or imply that the learner must reply unless a writing question is visible. Never read JSON or private context aloud.\n').replace(/^TURN:[^\r\n]*/m,'TURN: automatic guidance').replace(/If TURN is answer:[^\r\n]*/g,'The site verifies exercise answers separately. Give hints without claiming to grade or unlock activities.').replace(/Use assessment "none"\./g,'').replace(/(?:at most|under) 65 words/gi,'under 140 words');
 const learnerName=String(body.learner_name||'learner').replace(/[^\p{L}\p{M}\s'-]/gu,'').trim().slice(0,60)||'learner';
 const welcome=`Hi ${learnerName}, welcome to AI 102. In this course, you’ll learn how AI works—from patterns and tokens to examples, instructions, and tools—while you build and test your own AI agent across seven short missions. I’ll guide you step by step. To begin, choose your starting mission: the kind of AI agent you want to build.`;
 const questionRule=body.welcome_mode==='mission_briefing'?`WELCOME MODE. This is Eve's one and only course welcome. Say exactly: “${welcome}” Do not add a question or any other sentence.`:body.feedback_mode==='checked_feedback'?'CHECKED FEEDBACK MODE. The learner has already answered and the site has already checked it. Speak only the supplied checked feedback verbatim. Do not repeat the exercise question, ask for the answer, request another response, reinterpret the result or add a new question. Stop immediately after the feedback.':body.answer_state?'REVIEWED ANSWER MODE. The visible written answer has already been checked with result: '+body.answer_state+'. Do not ask the learner to answer it again. Briefly acknowledge the saved result and guide only the visible next action.':body.current_question?'WRITING MODE: A writable text area is visible. First complete the teaching explanation needed for this step, then ask only this exact current question: '+body.current_question+' Tell the learner to type in the box. Never ask for a spoken answer or add a second question.':body.choice_mode==='before_choice'?'CHOICE MODE: BEFORE SELECTION. A multiple-choice activity is visible and unanswered. Do not identify, quote, paraphrase, compare, eliminate, praise, hint at, teach toward or explain any option or the correct answer. Do not restate the lesson concept in a way that determines the answer. Say only one neutral direction to use the lesson and select the strongest answer on the page.':body.choice_mode==='after_choice'?'CHOICE MODE: AFTER SELECTION. The learner has selected an option. Explain only the result now shown on the page. If it is wrong, explain the misconception without naming the correct option; let the learner try the visible choices again. Do not ask a spoken question.':'EXPLAIN MODE: No writable text area is visible. Give the complete explanation for the current teaching step in 4–6 connected sentences. Do not stop after an introduction. You MUST NOT ask a question, use a question mark, say “tell me”, “what do you think”, “can you”, “would you”, or request any response. End with a complete teaching statement. Buttons and multiple-choice options are handled by the page.';
 return {instructions:instructions+'\nYou are Eve, the automatic lesson guide. The CURRENT PAGE, CURRENT STAGE, visible activity and selected agent in the private context are authoritative. Complete the full current teaching step before you stop. '+questionRule+' Respond directly without a greeting once already welcomed. Never claim to save an answer or complete a lesson. The site verifies exercises separately.'};
}
async function realtimeCall(request,env,user,row){
 const body=await request.json();if(typeof body.sdp!=='string'||!body.sdp.startsWith('v=0')||body.sdp.length>100000)fail(400,'Invalid voice connection.');
 const context=realtimeContext(body.context),pending='pending:'+crypto.randomUUID();
 const lock=await env.DB.prepare('UPDATE course_sessions SET call_id=? WHERE user_id=? AND token_hash=? AND call_id IS NULL').bind(pending,user,row.token_hash).run();
 if(lock.meta.changes!==1)fail(409,'Eve is already connected. Stop Eve before starting again.');
 let callId=null;
 try{
  await reserve(env,user);
  const form=new FormData();form.set('sdp',body.sdp);form.set('session',JSON.stringify({type:'realtime',model:'gpt-realtime-mini',instructions:context.instructions,max_output_tokens:400,output_modalities:['audio'],audio:{output:{voice:'marin'}}}));
  const result=await openai(env,'realtime/calls',{method:'POST',body:form,headers:{'OpenAI-Safety-Identifier':await hash(user)}});
  callId=(result.headers.get('location')||'').match(/\/calls\/([A-Za-z0-9_-]+)(?:$|\?)/)?.[1];if(!callId)fail(502,'Eve could not confirm her live connection.');
  const bind=await env.DB.prepare('UPDATE course_sessions SET call_id=? WHERE user_id=? AND token_hash=? AND call_id=?').bind(callId,user,row.token_hash,pending).run();
  if(bind.meta.changes!==1){await hangup(env,callId);fail(409,'Your course is open on another device.');}
  return json({sdp:await result.text(),call_id:callId,...context});
 }catch(error){if(callId)await hangup(env,callId).catch(()=>{});await env.DB.prepare('UPDATE course_sessions SET call_id=NULL WHERE user_id=? AND token_hash=? AND call_id=?').bind(user,row.token_hash,pending).run();throw error;}
}
export function teachingBody(body){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid teaching request.');
 for(const key of ['lesson','lesson_summary','learner_message'])if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>2000)fail(400,'Missing or too-long teaching text.');
 for(const [key,value] of Object.entries(body)){if(typeof value==='string'&&value.length>2000)fail(400,'Teaching context is too long.');}
 if(!['guidance','answer','conversation'].includes(body.turn_kind))fail(400,'Invalid teaching turn.');
 if(body.recent_turns&&!Array.isArray(body.recent_turns))fail(400,'Invalid conversation context.');
 if((body.recent_turns||[]).length>12)fail(400,'Conversation context is too long.');
 for(const key of ['available_presets','preset_examples'])if(body[key]&&(!Array.isArray(body[key])||body[key].length>6||body[key].some(x=>typeof x!=='string'||x.length>2000)))fail(400,'Invalid preset context.');
 for(const turn of body.recent_turns||[])if(!['eve','learner'].includes(turn.role)||typeof turn.text!=='string'||turn.text.length>2000)fail(400,'Invalid conversation turn.');
 return body;
}
export function teachingPrompt(body){
 const greeted=body.has_greeted===true||(body.recent_turns||[]).some(x=>x.role==='eve');
 let result=prompt.replace(/__([a-z_]+)__/g,(_,key)=>key==='greeting_rule'?(greeted?'This learner has already been welcomed. Do not greet or introduce yourself. Continue directly, including after resume and mission changes.':'Only the first Mission Briefing reply may greet the learner once. Other mission replies continue directly.'):(typeof body[key]==='string'?body[key]:'Not provided.'));
 if(body.welcome_mode==='mission_briefing')result+='\nThis is the one-time AI 102 course welcome. Greet the learner by name, explain that the course teaches how AI works while they build and test an AI agent across seven short missions, say you will guide them step by step, and direct them to choose their starting mission. Do not ask a question.';
 if(['mission briefing','start here'].includes(body.lesson.toLowerCase()))result+='\nThis is before Mission 1. Help only with choosing one listed preset or naming it. Available choices: '+(body.available_presets||[]).slice(0,3).join(' | ')+'. Never invent a different preset.';
 result+='\nPreset example questions: '+(body.preset_examples||[]).slice(0,3).join(' | ');
 const visible=String(body.visible_actions||'None').trim().slice(0,1000),next=String(body.next_action||'No learner action is currently available. Do not invent one.').trim().slice(0,1000);
 result+=`\nACTION GROUNDING — authoritative current screen state: Visible controls: ${visible}. Correct next action: ${next} If you direct the learner to act, use only this correct next action and quote a button label exactly when one is supplied. Never mention a different button, hidden activity, later mission, or earlier action.`;
 return result;
}
export function checkedReply(data,body){
 let raw=data.output_text;if(!raw)raw=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 let reply;try{reply=JSON.parse(raw);}catch{return null;}
 const text=reply?.text?.trim(),assessment=reply?.assessment;
 if(!text||text.length>1200||text.split(/\s+/).length>65)return null;
 if(!['correct','not_yet','unclear','none'].includes(assessment))return null;
 if(body.turn_kind==='answer'?assessment==='none':assessment!=='none')return null;
 const questions=(text.match(/[?？]/g)||[]).length;if(questions>1||(body.turn_kind==='answer'&&['correct','not_yet'].includes(assessment)&&questions))return null;
 if(/visible activit|current page|current step|private teaching|lesson summary|learner_message|assessment|I see no previous|part\s+\d+\s+of\s+\d+|^\s*[#*]|\n\s*[-*]/i.test(text))return null;
 if((body.has_greeted||(body.recent_turns||[]).some(x=>x.role==='eve'))&&greetings.test(text))return null;
 return {text,assessment};
}
async function reserve(env,user){
 if(!env.DB)fail(503,'Eve’s usage protection is not ready.');
 const now=new Date(),day=now.toISOString().slice(0,10),minute=now.toISOString().slice(0,16);
 const counters=[['course:'+day,600],['student:'+user+':'+day,180],['minute:'+user+':'+minute,20]];
 const statements=counters.map(([id,max])=>env.DB.prepare('INSERT INTO eve_usage (id,calls) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET calls=calls+1 WHERE calls<?').bind(id,max));
 const results=await env.DB.batch(statements);if(results.some(x=>x.meta.changes!==1))fail(429,'Eve’s usage limit has been reached. Continue with the written lesson and try again later.');
}
async function openai(env,path,options){
 const response=await fetch('https://api.openai.com/v1/'+path,{...options,signal:AbortSignal.timeout(45000),headers:{authorization:'Bearer '+env.OPENAI_API_KEY,...options.headers}});
 if(!response.ok)fail(502,'Eve could not complete this turn. Please try again.');return response;
}
async function respond(request,env){
 const body=teachingBody(await request.json()),instructions=teachingPrompt(body);
 const history=(body.recent_turns||[]).slice(-8).map(t=>t.role.toUpperCase()+': '+t.text).join('\n');
 const input='Conversation for this activity:\n'+history+'\n'+(body.turn_kind==='guidance'?'PRIVATE TEACHING EVENT: ':'LEARNER NOW: ')+body.learner_message;
 const assessments=body.turn_kind==='answer'?['correct','not_yet','unclear']:['none'];
 for(let i=0;i<2;i++){
  const result=await openai(env,'responses',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'gpt-5-mini',instructions,input:input+(i?'\nReturn a clear reply within the output contract. Do not greet again.':''),store:false,reasoning:{effort:'minimal'},max_output_tokens:650,text:{format:{type:'json_schema',name:'eve_reply',strict:true,schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'},assessment:{type:'string',enum:assessments}},required:['text','assessment']}}}})});
  const reply=checkedReply(await result.json(),body);if(reply)return json(reply);
 }
 fail(502,'Eve could not prepare a clear reply. Please try again.');
}
async function speech(request,env){
 const {text}=await request.json();if(typeof text!=='string'||!text.trim()||text.length>1200||text.split(/\s+/).length>85)fail(400,'Speech text is missing or too long.');
 const response=await openai(env,'audio/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'marin',input:text,response_format:'mp3'})});
 return json({audio_base64:encoded(new Uint8Array(await response.arrayBuffer())),mime_type:'audio/mpeg'});
}
async function transcribe(request,env){
 const form=await request.formData(),audio=form.get('audio');if(!audio||typeof audio==='string'||!audio.size||audio.size>3_000_000)fail(400,'Use a short recording under 3 MB.');
 const upload=new FormData();upload.append('file',audio,'learner.webm');upload.append('model','gpt-4o-mini-transcribe');upload.append('language','en');
 const response=await openai(env,'audio/transcriptions',{method:'POST',body:upload});const data=await response.json();if(typeof data.text!=='string'||!data.text.trim())fail(502,'Eve did not hear any words. Try again.');return json({text:data.text.slice(0,2000)});
}
export default {async fetch(request,env){try{
 const url=new URL(request.url),user=request.headers.get('oai-authenticated-user-id');
 // Sites custom sharing policy admits only the owner and email-invited students.
 if(!user){if(url.pathname.startsWith('/v1/')||url.pathname.startsWith('/api/')||url.pathname==='/health')return json({detail:'Sign in with an invited account to continue.'},401);return Response.redirect(url.origin+'/signin-with-chatgpt?return_to='+encodeURIComponent(url.pathname+url.search),302);}
 if(url.pathname==='/runtime-config.js')return new Response('window.BUILD_AI_CONFIG='+JSON.stringify({apiBaseUrl:url.origin,learnerStorageKey:user,gpuEnabled:false,requireCourseSession:true,realtimeEnabled:true})+';',{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}});
 if(url.pathname==='/health')return json({teacher_ready:Boolean(env.OPENAI_API_KEY&&env.DB),online:true});
 if(url.pathname==='/api/account')return json({signed_in:true,email:request.headers.get('oai-authenticated-user-email')||''});
 if(url.pathname==='/api/session/start'){
  if(request.method!=='POST')return json({detail:'Method not allowed.'},405);
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({detail:'Use the course page.'},403);
  if(Number(request.headers.get('content-length')||0)>1024)return json({detail:'Request is too large.'},413);
  return await startSession(request,env,user);
 }
 if(url.pathname==='/api/session/status'){await currentSession(request,env,user);return json({active:true});}
 if(url.pathname.startsWith('/v1/teacher/')){
  if(request.method!=='POST')return json({detail:'Use a teaching request.'},405);
  if(!['/v1/teacher/respond','/v1/teacher/speech','/v1/teacher/transcribe','/v1/teacher/realtime','/v1/teacher/realtime/context','/v1/teacher/realtime/stop'].includes(url.pathname))return json({detail:'Not found.'},404);
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({detail:'Use the course page for Eve.'},403);
  if(Number(request.headers.get('content-length')||0)>3_100_000)return json({detail:'Recording is too large.'},413);
  if(!env.OPENAI_API_KEY)fail(503,'Eve’s online connection is not configured yet.');
  const session=await currentSession(request,env,user);
  // Bound the actual body too: chunked uploads may have no Content-Length.
  const reader=request.body?.getReader(),chunks=[];let size=0;
  if(reader)while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>3_100_000){await reader.cancel();return json({detail:'Recording is too large.'},413);}chunks.push(item.value);}
  const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  request=new Request(request.url,{method:request.method,headers:request.headers,body});
  if(url.pathname.endsWith('/realtime/stop')){const body=await request.json();if(!body.call_id||body.call_id!==session.call_id)return json({stopped:true});await hangup(env,session.call_id);await env.DB.prepare('UPDATE course_sessions SET call_id=NULL WHERE user_id=? AND token_hash=? AND call_id=?').bind(user,session.token_hash,body.call_id).run();return json({stopped:true});}
  if(url.pathname.endsWith('/realtime/context'))return json(realtimeContext(await request.json()));
  if(url.pathname.endsWith('/realtime'))return await realtimeCall(request,env,user,session);
  await reserve(env,user);
  return url.pathname.endsWith('/respond')?await respond(request,env):url.pathname.endsWith('/speech')?await speech(request,env):await transcribe(request,env);
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return json({detail:'Method not allowed.'},405);
 if(!['/','/index.html','/runtime-config.js','/course-session.js','/styles.css','/classroom.css'].includes(url.pathname))await currentSession(request,env,user);
 const asset=assets[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return json({detail:'Not found.'},404);
 return new Response(request.method==='HEAD'?null:decode(asset.data),{headers:{'content-type':asset.type,'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}});
}catch(error){return json({detail:error.status?error.message:'The course service is temporarily unavailable. Please try again.'},error.status||503);}}};
