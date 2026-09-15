/* Course lease is checked by the server; this overlay is only the learner UI. */
window.CourseSession=(()=>{
 let active=!window.BUILD_AI_CONFIG?.requireCourseSession,busy=false,timer;
 const url=path=>(window.BUILD_AI_CONFIG?.apiBaseUrl||'')+path;
 function block(message,elsewhere=false){
  active=false;window.EveRealtime?.stop();const app=document.getElementById('app');if(app)app.inert=true;
  let panel=document.getElementById('course-session-gate');if(!panel){panel=document.createElement('section');panel.id='course-session-gate';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');document.body.append(panel);}
  panel.replaceChildren();const card=document.createElement('div');card.className='card';const heading=document.createElement('h1');heading.textContent=elsewhere?'Your course is open on another device':'Your course session';const text=document.createElement('p');text.textContent=message;const button=document.createElement('button');button.className='button';button.textContent=elsewhere?'Continue on this device':'Try again';button.onclick=()=>start(elsewhere);card.append(heading,text,button);panel.append(card);button.focus();
 }
 function allow(){active=true;document.getElementById('course-session-gate')?.remove();const app=document.getElementById('app');if(app)app.inert=false;window.dispatchEvent(new Event('course-session-ready'));}
 async function start(takeover=false){
  if(busy)return false;busy=true;
  try{const r=await fetch(url('/api/session/start'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({takeover}),credentials:'same-origin'});const data=await r.json();if(!r.ok){block(data.detail||'Could not start your session.',r.status===409);return false;}allow();return true;}
  catch{block('Your connection was interrupted. Your saved work is still here.');return false;}
  finally{busy=false;}
 }
 async function check(){if(!window.BUILD_AI_CONFIG?.requireCourseSession||busy)return active;try{const r=await fetch(url('/api/session/status'),{credentials:'same-origin',cache:'no-store'});if(!r.ok){block(r.status===409?'Continue here to end the other session.':'Reconnect before continuing.',r.status===409);return false;}allow();return true;}catch{block('Reconnect before continuing. Your saved work is still here.');return false;}}
 async function boot(){if(!window.BUILD_AI_CONFIG?.requireCourseSession){allow();return;}block('Connecting your private course session…');await start();timer=setInterval(check,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});window.addEventListener('focus',()=>void check());}
 return {boot,start,check,get active(){return active;},block};
})();
