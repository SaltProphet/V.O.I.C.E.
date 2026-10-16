/* Local API adapter. Visual state belongs to visual-runtime.js; audio is never simulated. */
const byId=id=>document.getElementById(id);
const realAudio=new Audio();realAudio.preload='metadata';
let hostProfiles=[],hostAssets=[],currentAsset=null,currentExport=null,mediaSource=null;
let generating=false,applying=false,importing=false,visualPaused=false,stopRequested=false;
let pendingJob=null,micSource=null,micBusy=false,inputAnalyser=null;
let sequenceDraft=[];
try{sequenceDraft=JSON.parse(localStorage.getItem('auravoice-dialogue')||'[]')}catch{}
if(!Array.isArray(sequenceDraft)||!sequenceDraft.length)sequenceDraft=[{id:crypto.randomUUID(),profile:'',text:''}];
const tellParent=(type,payload={})=>parent.postMessage({source:'voice-studio-stage',type,...payload},HOST_ORIGIN);
const setStatus=(message,error=false)=>{byId('studio-live-status').textContent=message;byId('studio-live-status').style.color=error?'#fda4af':'#a1a1aa'};
function persist(){try{localStorage.setItem('auravoice-dialogue',JSON.stringify(sequenceDraft))}catch{}}
async function studioAPI(path,body){
 const options=body instanceof FormData?{method:'POST',body}:body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
 const response=await fetch(HOST_ORIGIN+'/api'+path,options);
 let value;try{value=await response.json()}catch{throw Error('The local server returned an unreadable response ('+response.status+').')}
 if(!response.ok)throw Error(typeof value.detail==='string'?value.detail:JSON.stringify(value.detail));return value;
}
function syncTransport(){
 state.isPlaying=!realAudio.paused;state.currentTime=realAudio.currentTime;state.totalDuration=Number.isFinite(realAudio.duration)?realAudio.duration:0;
 const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
 byId('current-time').textContent=fmt(state.currentTime);byId('total-time').textContent=fmt(state.totalDuration);
 byId('progress-fill').style.width=(state.totalDuration?100*state.currentTime/state.totalDuration:0)+'%';
 byId('synth-btn-text').textContent=generating?'Generating…':'Synthesize Sequence';
 byId('synthesize-btn').disabled=generating||applying||importing||!hostProfiles.length;
 byId('studio-apply-effects').disabled=generating||applying||!currentAsset;
 byId('studio-save-profile').disabled=importing||generating;
 byId('export-audio-btn').disabled=!currentAsset&&!currentExport;
 byId('studio-play').disabled=!realAudio.src||generating;
 byId('synthesis-badge').textContent=generating?'GENERATING':state.isPlaying?'PLAYING':'AMBIENT';
 byId('tone-status-text').textContent=state.isPlaying?'LOCAL AUDIO':state.isMicActive?'LIVE MICROPHONE':'AMBIENT MOTION';
 document.querySelectorAll('.track-text,.track-voice,.remove-track,#add-track-btn').forEach(el=>el.disabled=generating);
 tellParent('busy',{enabled:generating||applying||importing});
}
function connectOutput(){
 const ctx=getAudioContext();
 if(!mediaSource){mediaSource=ctx.createMediaElementSource(realAudio);mediaSource.connect(getMasterAnalyser());masterAnalyser.connect(ctx.destination);micDataArray=new Uint8Array(masterAnalyser.frequencyBinCount)}
 return ctx.resume();
}
async function playCurrent(){if(!realAudio.src)return;try{if(state.isMicActive)await toggleMicrophone();await connectOutput();tellParent('playing');await realAudio.play()}catch(error){setStatus(error.message,true)}}
function showAsset(asset){
 realAudio.pause();currentAsset=asset;currentExport=null;realAudio.src=HOST_ORIGIN+'/api/assets/'+asset.id+'/audio';
 byId('studio-audio-name').textContent=asset.name;byId('bitrate-tag').textContent=Math.round(asset.sample_rate/1000)+' kHz WAV';
 byId('studio-download').href=realAudio.src;byId('studio-download').hidden=false;syncTransport();
}
function addAsset(asset){hostAssets=[asset,...hostAssets.filter(a=>a.id!==asset.id)];updateLibrary();tellParent('asset-created',{asset})}
function updateLibrary(){
 for(const id of ['studio-audio-select','reference-asset']){
  const el=byId(id),previous=el.value;el.replaceChildren(new Option(id==='reference-asset'?'Choose reference recording…':'Choose a recording…',''));
  hostAssets.forEach(a=>el.add(new Option(a.name+' · '+a.duration.toFixed(1)+'s',a.id)));el.value=previous;
 }
}
function selectVisual(key){
 state.selectedVoice=key;applyArchetypeColors(voiceProfiles[key]);renderVoiceCards();
 byId('hud-freq-label').textContent='Visual carrier · '+voiceProfiles[key].baseFreq+' Hz';
}
function renderVoiceCards(){
 const list=byId('voice-list');list.replaceChildren();
 for(const [key,p] of Object.entries(voiceProfiles)){
  const available=hostProfiles.find(item=>item.archetype===key);
  const button=document.createElement('button');button.type='button';button.className='voice-card w-full text-left p-3 rounded-xl border bg-zinc-950/40 transition-all flex items-center justify-between';
  button.dataset.voice=key;button.style.borderColor=state.selectedVoice===key?p.colorHex:'#ffffff12';button.setAttribute('aria-pressed',state.selectedVoice===key);
  const content=document.createElement('span'),name=document.createElement('span'),detail=document.createElement('small');
  name.textContent=p.name;name.style.color=p.colorHex;name.className='block text-sm';
  detail.textContent=available?'Local voice reference':'Visual palette · choose a saved voice below';detail.className='block text-[10px] text-zinc-500';content.append(name,detail);button.append(content);
  button.onclick=()=>{selectVisual(key);if(available){const empty=sequenceDraft.find(t=>!t.profile);if(empty){empty.profile=available.id;persist();renderTimeline()}}};list.append(button);
 }
 byId('archetype-count-badge').textContent=hostProfiles.length+' SAVED VOICES';
}
function renderTimeline(){
 const container=byId('timeline-container');container.replaceChildren();
 sequenceDraft.forEach((track,index)=>{
  const row=document.createElement('div');row.className='timeline-track flex items-start gap-3 bg-zinc-950/60 p-3 rounded-xl border border-white/5';
  const select=document.createElement('select');select.className='track-voice bg-zinc-900 text-xs text-zinc-300 rounded p-1';select.setAttribute('aria-label','Voice for sequence '+(index+1));
  select.add(new Option('Choose voice…',''));hostProfiles.forEach(p=>select.add(new Option(p.name,p.id)));select.value=track.profile;
  if(track.profile&&!hostProfiles.some(p=>p.id===track.profile)){select.add(new Option('Unavailable voice',track.profile));select.value=track.profile}
  select.onchange=()=>{track.profile=select.value;persist()};
  const text=document.createElement('textarea');text.className='track-text flex-1 min-w-0 bg-transparent text-sm text-zinc-200';text.rows=2;text.maxLength=10000;text.placeholder='Write dialogue for this sequence…';text.setAttribute('aria-label','Dialogue for sequence '+(index+1));text.value=track.text;text.oninput=()=>{track.text=text.value;persist()};
  const remove=document.createElement('button');remove.className='remove-track text-zinc-400';remove.textContent='×';remove.setAttribute('aria-label','Remove sequence '+(index+1));remove.onclick=()=>{sequenceDraft=sequenceDraft.filter(t=>t.id!==track.id);persist();renderTimeline()};
  row.append(select,text,remove);container.append(row);
 });syncTransport();
}
function stopSynthesizer(){
 realAudio.pause();stopRequested=true;
 if(generating)setStatus('Stopping after the current server job. Completed takes are kept.');
 else{realAudio.currentTime=0;setStatus('Playback stopped.')}syncTransport();
}
async function waitForJob(id){
 pendingJob=id;
 try{for(;;){await new Promise(resolve=>setTimeout(resolve,1500));const job=await studioAPI('/jobs/'+id);if(job.status==='failed')throw Error(job.error||'Local generation failed.');if(job.status==='complete')return job.asset}}
 finally{pendingJob=null}
}
async function generateSequence(){
 if(generating||applying)return;
 const queue=sequenceDraft.filter(t=>t.text.trim()).map(t=>({...t}));
 if(!queue.length){setStatus('Enter dialogue in at least one sequence block.',true);return}
 if(queue.some(t=>!hostProfiles.some(p=>p.id===t.profile))){setStatus('Choose a saved voice for every nonempty sequence block.',true);return}
 generating=true;stopRequested=false;realAudio.pause();syncTransport();
 const clips=[];let at=0;
 try{
  for(let i=0;i<queue.length;i++){
   if(stopRequested)break;
   const t=queue[i];setStatus('Generating sequence '+(i+1)+' / '+queue.length+' locally…');
   const job=await studioAPI('/generate',{profile:t.profile,text:t.text.trim(),language:byId('studio-language').value});
   const asset=await waitForJob(job.id);addAsset(asset);
   clips.push({id:crypto.randomUUID(),asset:asset.id,track:'dialogue',at,in:0,out:asset.duration});at+=asset.duration;showAsset(asset);
  }
  if(stopRequested){setStatus('Sequence stopped. Completed takes are in the library.');return}
  if(clips.length>1){
   const session={name:'AuraVoice dialogue',tracks:[{id:'dialogue',name:'Dialogue',volume:1,mute:false}],clips};
   const saved=await studioAPI('/sessions',session);tellParent('refresh');
   currentExport=await studioAPI('/export',saved);realAudio.src=HOST_ORIGIN+currentExport.url;
   byId('studio-download').href=realAudio.src;byId('studio-audio-name').textContent='Dialogue sequence · '+clips.length+' takes';
  }
  setStatus('Sequence ready. Original takes and any combined session are saved.');
  await playCurrent();
 }catch(error){setStatus(error.message,true)}finally{generating=false;syncTransport()}
}
async function applyEffects(){
 if(!currentAsset||generating||applying)return;
 if(currentExport){setStatus('Choose an individual take from Saved audio before shaping it.',true);return}
 applying=true;syncTransport();
 try{
  const asset=await studioAPI('/assets/'+currentAsset.id+'/process',{start:0,end:currentAsset.duration,pitch:12*Math.log2(state.pitch),timbre:(state.timbreShift-50)/50,vibrato:state.vibrato/100});
  addAsset(asset);showAsset(asset);setStatus('Shaped copy saved; original retained.');await playCurrent();
 }catch(error){setStatus(error.message,true)}finally{applying=false;syncTransport()}
}
async function importReference(file){
 if(!file||importing)return;importing=true;syncTransport();
 try{setStatus('Importing reference audio…');const data=new FormData();data.append('file',file);const asset=await studioAPI('/import',data);addAsset(asset);showAsset(asset);byId('reference-asset').value=asset.id;byId('reference-name').value=file.name.replace(/\.[^.]+$/,'').slice(0,100);setStatus('Audio imported. Enter its exact transcript, then save the reference.')}
 catch(error){setStatus(error.message,true)}finally{importing=false;syncTransport()}
}
async function saveReference(){
 if(importing||generating)return;
 const name=byId('reference-name').value.trim(),transcript=byId('reference-transcript').value.trim(),asset=byId('reference-asset').value;
 if(!name||!transcript||!asset){setStatus('Choose a recording, voice name, and exact transcript.',true);return}
 importing=true;syncTransport();
 try{const profile=await studioAPI('/profiles',{name,transcript,asset});hostProfiles=[profile,...hostProfiles];renderVoiceCards();renderTimeline();tellParent('refresh');setStatus('Voice reference saved. Select it in a sequence block.')}
 catch(error){setStatus(error.message,true)}finally{importing=false;syncTransport()}
}
async function toggleMicrophone(){
 if(micBusy)return;micBusy=true;
 try{
  if(state.isMicActive){micStream?.getTracks().forEach(t=>t.stop());micSource?.disconnect();micStream=null;micSource=null;state.isMicActive=false}
  else{realAudio.pause();micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});micSource=getAudioContext().createMediaStreamSource(micStream);getMasterAnalyser();inputAnalyser=getAudioContext().createAnalyser();inputAnalyser.fftSize=512;micSource.connect(inputAnalyser);micDataArray=new Uint8Array(inputAnalyser.frequencyBinCount);state.isMicActive=true}
  byId('mic-status-label').textContent=state.isMicActive?'SENSING':'OFF';setStatus(state.isMicActive?'Microphone drives the visual field. Use Recorder & editor to record.':'Microphone sensing off.');
 }catch(error){micStream?.getTracks().forEach(t=>t.stop());setStatus('Microphone: '+error.message,true)}finally{micBusy=false;syncTransport()}
}
byId('studio-language').value='English';
byId('synthesize-btn').onclick=generateSequence;
byId('stop-btn').onclick=stopSynthesizer;byId('stop-btn').setAttribute('aria-label','Stop playback or sequence');
byId('studio-play').onclick=()=>realAudio.paused?playCurrent():realAudio.pause();
byId('studio-apply-effects').onclick=applyEffects;
byId('studio-open-editor').onclick=()=>{realAudio.pause();tellParent('open-editor',{assetId:currentExport?null:currentAsset?.id})};
byId('studio-audio-select').onchange=e=>{const asset=hostAssets.find(a=>a.id===e.target.value);if(asset)showAsset(asset)};
byId('export-audio-btn').onclick=()=>{if(!realAudio.src)return;byId('studio-download').click()};
byId('add-track-btn').onclick=()=>{sequenceDraft.push({id:crypto.randomUUID(),profile:hostProfiles.find(p=>p.archetype===state.selectedVoice)?.id||hostProfiles[0]?.id||'',text:''});persist();renderTimeline()};
byId('studio-save-profile').onclick=saveReference;
const dropzone=byId('audio-dropzone');dropzone.setAttribute('role','button');dropzone.tabIndex=0;
dropzone.onclick=()=>byId('studio-file').click();dropzone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();byId('studio-file').click()}};
dropzone.ondragover=e=>e.preventDefault();dropzone.ondrop=e=>{e.preventDefault();importReference(e.dataTransfer.files[0])};
byId('studio-file').onchange=e=>{importReference(e.target.files[0]);e.target.value=''};
byId('toggle-mic-btn').onclick=toggleMicrophone;
byId('progress-container').onclick=e=>{if(Number.isFinite(realAudio.duration)){const box=e.currentTarget.getBoundingClientRect();realAudio.currentTime=Math.max(0,Math.min(realAudio.duration,(e.clientX-box.left)/box.width*realAudio.duration));syncTransport()}};
byId('studio-quality').onchange=e=>{visualPaused=e.target.value==='still';renderer.setPixelRatio(Math.min(devicePixelRatio,e.target.value==='high'?2:1));helixGeo.setDrawRange(0,e.target.value==='low'?600:HELIX_POINTS);fluidGeo.setDrawRange(0,e.target.value==='low'?2500:9000);dustGeo.setDrawRange(0,e.target.value==='low'?600:1800)};
['timeupdate','loadedmetadata','play','pause','ended'].forEach(type=>realAudio.addEventListener(type,syncTransport));
realAudio.onerror=()=>setStatus('Unable to play this audio. Choose it again or check the local server.',true);
window.addEventListener('message',e=>{
 if(e.origin!==HOST_ORIGIN||e.source!==parent||e.data?.source!=='voice-studio-host')return;
 if(e.data.type==='library'){hostAssets=e.data.assets;hostProfiles=e.data.profiles;updateLibrary();renderVoiceCards();renderTimeline();if(!hostProfiles.length)setStatus('Import a reference or record your voice in Recorder & editor to begin.')}
 if(e.data.type==='suspend'){visualPaused=true;realAudio.pause();if(state.isMicActive)toggleMicrophone()}
 if(e.data.type==='resume')visualPaused=byId('studio-quality').value==='still';
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.isZenMode)toggleZenMode()});
const originalZen=toggleZenMode;
toggleZenMode=function(){originalZen();tellParent('zen',{enabled:state.isZenMode})};
new MutationObserver(()=>tellParent('zen',{enabled:state.isZenMode})).observe(byId('main-header'),{attributes:true,attributeFilter:['class']});
window.addEventListener('beforeunload',()=>{realAudio.pause();micStream?.getTracks().forEach(t=>t.stop());audioCtx?.close();renderer.dispose()});
if(matchMedia('(prefers-reduced-motion: reduce)').matches){visualPaused=true;byId('studio-quality').value='still'}
for(const [id,label] of [['param-pitch','Pitch multiplier'],['param-timbre','Timbre color'],['param-vibrato','Vibrato'],['param-drift','Visual fluid motion']])byId(id).setAttribute('aria-label',label);
setStatus('Local Qwen3-TTS · real recordings, saved voices, and WAV exports.');
tellParent('ready');
for(const [id,key,output,format] of [
 ['param-pitch','pitch','val-pitch',v=>v.toFixed(2)+'×'],
 ['param-timbre','timbreShift','val-timbre',v=>v+'%'],
 ['param-vibrato','vibrato','val-vibrato',v=>v+'%'],
 ['param-drift','curlForce','val-drift',v=>v.toFixed(2)]
]){
 const slider=byId(id);slider.value=state[key];
 const update=()=>{state[key]=Number(slider.value);if(byId(output))byId(output).textContent=format(state[key])};
 slider.oninput=update;update();
}
if(byId('reset-params-btn'))byId('reset-params-btn').onclick=()=>{
 for(const [id,value] of [['param-pitch',1],['param-timbre',50],['param-vibrato',0],['param-drift',.75]]){byId(id).value=value;byId(id).dispatchEvent(new Event('input'))}
};
