/* A single WebRTC voice connection: streamed speech, automatic turns, barge-in. */
window.EveRealtime=(()=>{
 let pc=null,dc=null,stream=null,audio=null,connecting=null,epoch=0,revision=0,day=0,spokenDay=0,context=null,responseActive=false,audioSpeaking=false,awaiting=false,events=[],lastActivity=0,watch,callId=null,closing=Promise.resolve();
 const enabled=()=>window.BUILD_AI_CONFIG?.realtimeEnabled===true;
 const send=event=>{if(dc?.readyState==='open')dc.send(JSON.stringify(event));};
 async function api(path,body){const r=await fetch((BUILD_AI_CONFIG.apiBaseUrl||'')+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok){if(r.status===409&&!/already connected/i.test(data.detail||''))CourseSession.block(data.detail,true);throw Error(data.detail||'Eve could not connect.');}return data;}
 function paint(){if(!enabled()||typeof voiceSession==='undefined')return;const orb=document.getElementById('eve-orb');if(orb){orb.disabled=false;orb.textContent='Talk to Eve';orb.setAttribute('aria-label','Talk to Eve');orb.setAttribute('aria-pressed',String(!!pc));orb.setAttribute('aria-describedby','eve-live-controls');orb.title=pc?'Click again to stop Eve':'Start talking with Eve';orb.onclick=()=>pc?stop():startForPage();}const state=voiceSession.phase==='error'?'error':pc&&dc?.readyState!=='open'?'connecting':audioSpeaking?'speaking':responseActive||awaiting?'preparing':pc?'listening':connecting?'connecting':'idle';if(orb)orb.dataset.eveState=state;let controls=document.getElementById('eve-live-controls');if(!controls&&orb){controls=document.createElement('div');controls.id='eve-live-controls';controls.className='eve-live-controls';orb.after(controls);}if(controls){controls.replaceChildren();const status=document.createElement('span');status.setAttribute('role','status');const labels={speaking:'Eve is speaking',preparing:'Eve is preparing her reply',connecting:'Connecting to Eve',listening:'Your turn — Eve is listening',idle:'Eve is off',error:'Eve could not connect'};status.textContent=labels[state]+'. '+(state==='error'?'Click Talk to Eve to try again.':pc?'Speak anytime to interrupt. Click again to stop.':'Click Talk to Eve to begin.');controls.dataset.eveState=state;controls.append(status);}}
 function interrupt(){if(responseActive)send({type:'response.cancel'});send({type:'output_audio_buffer.clear'});responseActive=false;audioSpeaking=false;awaiting=false;events=[];paint();}
 function stop(notify=true){const id=callId;callId=null;epoch++;revision++;clearInterval(watch);watch=null;events=[];awaiting=false;responseActive=false;audioSpeaking=false;connecting=null;pc?.close();dc?.close();stream?.getTracks().forEach(t=>t.stop());if(audio){audio.pause();audio.srcObject=null;audio.remove();}pc=dc=stream=audio=null;if(typeof voiceSession!=='undefined'){voiceSession.generation++;voiceSession.enabled=false;voiceSession.phase='idle';}paint();if(id&&notify&&enabled()&&CourseSession.active)closing=api('/v1/teacher/realtime/stop',{call_id:id}).catch(()=>{});}
 async function onEvent(event,token){
  if(token!==epoch)return;lastActivity=Date.now();
  if(event.type==='input_audio_buffer.speech_started'){responseActive=false;events=[];awaiting=false;updateEveDebug('Speech detected by the microphone.');paint();}
  if(event.type==='response.created'){responseActive=true;spokenDay=day;awaiting=false;updateEveDebug('Eve is preparing her reply.');paint();}
  if(event.type==='output_audio_buffer.started'){responseActive=true;audioSpeaking=true;project().guidance.eveGreeted=true;save();updateEveDebug('Eve audio playback started.');paint();}
  if(event.type==='output_audio_buffer.stopped'||event.type==='output_audio_buffer.cleared'){responseActive=false;audioSpeaking=false;updateEveDebug(event.type==='output_audio_buffer.cleared'?'Eve audio was interrupted.':'Eve finished audio playback.');paint();}
  if(event.type==='response.output_audio_transcript.done'||event.type==='response.audio_transcript.done'){if(event.transcript){saveEveTurn(spokenDay,'eve',event.transcript);project().guidance.eveGreeted=true;save();updateEveDebug('Live Eve replied.',{reply:event.transcript,error:''});}paint();}
  if(event.type==='conversation.item.input_audio_transcription.completed'&&event.transcript?.trim()){
   const text=event.transcript.trim();saveEveTurn(day,'learner',text);updateEveDebug('Eve heard you live.',{heard:text,error:''});
   const input=day===1?document.querySelector('textarea[id^="day1-answer-"]'):day===2?document.getElementById('day2-answer'):null;
   if(input&&context?.turn_detection.create_response===false&&!input.readOnly){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));if(day===1)await checkDay1Answer(input.id.replace('day1-answer-',''));else await checkDay2Answer();}
  }
  if(event.type==='error'){if(['response_cancel_not_active','output_audio_buffer_clear_empty'].includes(event.error?.code))return;const message='Eve’s live connection was interrupted. Please try again.';stop();voiceState('error',message);paint();}
 }
 async function connect(payload){
  if(pc&&dc?.readyState==='open')return;if(connecting)return connecting;
  const token=epoch;connecting=(async()=>{
   await closing;if(token!==epoch)return;if(!await CourseSession.check())throw Error('Continue on this device before talking to Eve.');
   // If a stop request was dropped, the same verified lease recovers its call.
   if(!await CourseSession.start())throw Error('Eve could not recover her connection. Please try again.');if(token!==epoch)return;
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});if(token!==epoch){media.getTracks().forEach(t=>t.stop());return;}
   stream=media;pc=new RTCPeerConnection();audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.hidden=true;document.body.append(audio);pc.ontrack=e=>{audio.srcObject=e.streams[0];void audio.play().catch(()=>{voiceState('error','Click Talk to Eve to enable sound.');});};stream.getAudioTracks().forEach(track=>pc.addTrack(track,stream));dc=pc.createDataChannel('oai-events');dc.onmessage=e=>{try{void onEvent(JSON.parse(e.data),token);}catch{}};
   pc.onconnectionstatechange=()=>{if(token===epoch&&['failed','disconnected'].includes(pc?.connectionState)){stop();voiceState('error','Eve lost her connection. Your work is saved. Try again.');paint();}};
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);const result=await api('/v1/teacher/realtime',{sdp:offer.sdp,context:payload});if(token!==epoch){void api('/v1/teacher/realtime/stop',{call_id:result.call_id}).catch(()=>{});return;}callId=result.call_id;
   context=result;await pc.setRemoteDescription({type:'answer',sdp:result.sdp});await new Promise((resolve,reject)=>{if(dc.readyState==='open')return resolve();const timer=setTimeout(()=>reject(Error('Eve took too long to connect. Try again.')),15000);dc.onopen=()=>{clearTimeout(timer);resolve();};dc.onerror=()=>{clearTimeout(timer);reject(Error('Eve could not open live audio.'));};});
   if(token!==epoch)return;voiceSession.phase='listening';voiceSession.enabled=true;lastActivity=Date.now();const started=Date.now();watch=setInterval(()=>{if(Date.now()-lastActivity>90000||Date.now()-started>900000){stop();paint();}},5000);paint();
  })().catch(error=>{if(token===epoch){stop();voiceState('error',error.name==='NotAllowedError'?'Allow microphone access to talk to Eve, or continue reading.':error.message);paint();}throw error;}).finally(()=>{if(token===epoch)connecting=null;});return connecting;
 }
 async function guide(d,message,transition=null,exact=false){
  if(!enabled()||!voiceSession.enabled||!CourseSession.active)return;claimEveTeachingEvent(d);day=d;const rev=++revision,payload=evePayload(d,message,'guidance',transition);interrupt();
  try{await connect(payload);if(rev!==revision||!pc)return;context=await api('/v1/teacher/realtime/context',payload);if(rev!==revision||!pc)return;send({type:'session.update',session:{type:'realtime',instructions:context.instructions,audio:{input:{turn_detection:context.turn_detection}}}});
   // A new activity has fresh, private teaching context; it is never learner speech.
   send({type:'response.create',response:{instructions:context.instructions+'\nFor this turn only: '+(exact?'Speak this checked feedback exactly, without another question: ':'Teach this current event in your own words, not by reading instructions: ')+message,output_modalities:['audio']}});awaiting=true;paint();
  }catch(error){if(rev===revision){stop();voiceState('error',error.message);paint();}}
 }
 async function startForPage(){voiceSession.enabled=true;day=store.page==='intro'?0:labDay(store.page)||0;await guide(day,'Continue the current activity naturally. If I have already been welcomed, do not greet again.');}
 function install(){if(!enabled())return;const state=voiceState;voiceState=(phase,error='')=>{state(phase,error);paint();};const cancel=cancelVoice;cancelVoice=()=>{interrupt();cancel();};stopEve=()=>stop();useEve=()=>pc?stop():startForPage();retryEve=()=>startForPage();toggleEveRecording=()=>startForPage();eveTeachMoment=(d,message,transition)=>guide(d,message,transition);playLiveEve=(text,d)=>guide(d,text,null,true);sendLiveEve=async(d,text)=>{day=d;await connect(evePayload(d,text));send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});send({type:'response.create'});};
  const navigate=go;go=page=>{const keep=voiceSession.enabled;stop();navigate(page);voiceSession.enabled=keep;};const renderPage=render;render=()=>{renderPage();paint();};window.addEventListener('pagehide',()=>stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 }
 return {install,guide,stop,interrupt,paint,startForPage,get connected(){return !!pc;}};
})();
