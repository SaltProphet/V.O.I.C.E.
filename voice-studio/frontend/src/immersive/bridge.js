/* Connect the supplied visual playground to Voice Studio's existing APIs. */
const realAudio = new Audio();
realAudio.preload = 'metadata';
let hostProfiles=[],hostAssets=[],selectedProfile=null,sourceAsset=null,renderedAsset=null;
let generating=false,applying=false,mediaSource=null,outputAnalyser=null,frequencyData=null,timeData=null;
let effectKey='',renderKey='',visualPaused=false;
const apiRoot=HOST_ORIGIN;
const byId=id=>document.getElementById(id);
async function studioAPI(path,body){
 const r=await fetch(apiRoot+'/api'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
 const value=await r.json();if(!r.ok)throw new Error(typeof value.detail==='string'?value.detail:JSON.stringify(value.detail));return value;
}
function tellParent(type,payload={}){parent.postMessage({source:'voice-studio-stage',type,...payload},HOST_ORIGIN)}
function setStatus(message,error=false){
 byId('studio-live-status').textContent=message;byId('studio-live-status').style.color=error?'#fda4af':'#a1a1aa';
 if(error)showToast(message);
}
function connectOutput(){
 const ctx=getAudioContext();
 if(!mediaSource){mediaSource=ctx.createMediaElementSource(realAudio);outputAnalyser=ctx.createAnalyser();outputAnalyser.fftSize=2048;outputAnalyser.smoothingTimeConstant=.8;mediaSource.connect(outputAnalyser);outputAnalyser.connect(ctx.destination);frequencyData=new Uint8Array(outputAnalyser.frequencyBinCount);timeData=new Float32Array(outputAnalyser.fftSize)}
 ctx.resume();
}
function stopCarrier(){stopSynthesizer();}
function syncTransport(){
 state.isPlaying=!realAudio.paused;state.currentTime=realAudio.currentTime;state.totalDuration=Number.isFinite(realAudio.duration)?realAudio.duration:0;
 const format=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
 byId('current-time').textContent=format(state.currentTime);byId('total-time').textContent=format(state.totalDuration);
 byId('progress-fill').style.width=(state.totalDuration?100*state.currentTime/state.totalDuration:0)+'%';
 byId('synth-btn-text').textContent=generating?'Generating speech…':'Synthesize & Play';
 byId('synthesize-btn').disabled=generating||applying||!selectedProfile;
 byId('play-icon').setAttribute('data-lucide',realAudio.paused?'play':'pause');
 byId('synthesis-badge').textContent=generating?'GENERATING':state.isPlaying?'PLAYING':'READY';
 byId('recording-pulse').classList.toggle('hidden',!state.isPlaying);
 lucide.createIcons();
}
function updateLibrary(){
 const select=byId('studio-audio-select');const before=select.value;select.replaceChildren(new Option('Choose audio to play or shape…',''));
 hostAssets.forEach(a=>select.add(new Option(a.name+' · '+a.duration.toFixed(1)+'s',a.id)));select.value=before;
}
function updateProfiles(){
 const select=byId('studio-profile-select');const current=select.value;select.replaceChildren(new Option('Use selected character',''));
 hostProfiles.forEach(p=>select.add(new Option(p.name,p.id)));select.value=current;
 if(current)selectedProfile=hostProfiles.find(p=>p.id===current);
 else selectedProfile=hostProfiles.find(p=>p.archetype===state.selectedVoice);
 document.querySelectorAll('.voice-card').forEach(card=>{
  const p=hostProfiles.find(p=>p.archetype===card.dataset.voice);card.setAttribute('aria-label',voiceProfiles[card.dataset.voice].name);card.setAttribute('role','button');card.tabIndex=0;
  card.style.opacity=p?'1':'.45';card.title=p?'Select '+p.name:'Voice reference is being prepared';
 });
 byId('archetype-count-badge').textContent=hostProfiles.filter(p=>p.archetype).length+' VOICES';syncTransport();
}
function showAsset(asset){
 sourceAsset=asset;renderedAsset=asset;effectKey='';renderKey='';realAudio.pause();realAudio.src=apiRoot+'/api/assets/'+asset.id+'/audio';
 byId('studio-download').href=realAudio.src;byId('studio-download').hidden=false;
 byId('studio-audio-name').textContent=asset.name;
 byId('bitrate-tag').textContent=(asset.sample_rate/1000).toFixed(0)+' kHz · WAV';
 byId('studio-open-editor').disabled=false;
 syncTransport();
}
function settings(){return {pitch:12*Math.log2(state.pitch),timbre:(state.timbreShift-50)/50,vibrato:state.vibrato/100}}
async function prepareEffects(){
 if(!sourceAsset)throw new Error('Generate speech or choose an audio clip first.');
 const ops=settings(),key=JSON.stringify(ops);
 if(key===effectKey&&renderKey===sourceAsset.id)return renderedAsset;
 const unchanged=Object.values(ops).every(v=>Math.abs(v)<.0001);
 if(unchanged){renderedAsset=sourceAsset;effectKey=key;renderKey=sourceAsset.id;return sourceAsset}
 applying=true;syncTransport();setStatus('Rendering pitch, color, and vibrato…');
 try{
  renderedAsset=await studioAPI('/assets/'+sourceAsset.id+'/process',{start:0,end:sourceAsset.duration,...ops});
  effectKey=key;renderKey=sourceAsset.id;
  hostAssets.unshift(renderedAsset);updateLibrary();tellParent('asset-created',{asset:renderedAsset});
  return renderedAsset;
 }finally{applying=false;syncTransport()}
}
async function playCurrent(){
 if(applying||generating)return;
 try{
  stopCarrier();realAudio.pause();const asset=await prepareEffects();
  const url=apiRoot+'/api/assets/'+asset.id+'/audio';if(realAudio.src!==url)realAudio.src=url;
  connectOutput();await realAudio.play();byId('studio-download').href=url;byId('studio-download').hidden=false;setStatus('Playing '+asset.name);syncTransport();
 }catch(e){setStatus(e.message,true);syncTransport()}
}
async function generateSpeech(){
 if(generating||applying)return;
 try{
  if(!selectedProfile)throw new Error('Select a saved voice or wait for the character references to finish.');
  const text=byId('speech-script').value.trim();if(!text)throw new Error('Enter some dialogue first.');
  realAudio.pause();stopCarrier();generating=true;syncTransport();setStatus('Generating with '+selectedProfile.name+' on your local GPU…');
  const job=await studioAPI('/generate',{profile:selectedProfile.id,text,language:'English'});
  let result;
  for(let n=0;n<1200;n++){
   await new Promise(resolve=>setTimeout(resolve,1500));result=await studioAPI('/jobs/'+job.id);
   if(result.status==='failed')throw new Error(result.error);
   if(result.status==='complete')break;
  }
  if(result.status!=='complete')throw new Error('Generation is taking longer than expected. Check the studio logs.');
  hostAssets.unshift(result.asset);updateLibrary();showAsset(result.asset);tellParent('asset-created',{asset:result.asset});
  generating=false;await playCurrent();
 }catch(e){setStatus(e.message,true)}finally{generating=false;syncTransport()}
}
// Retain the original oscillator preview as a playful carrier instrument.
function playSyntheticSpeech(previewOnly=false){if(previewOnly){realAudio.pause();playCarrierTone(true)}else generateSpeech()}
byId('synthesize-btn').addEventListener('click',generateSpeech);
byId('preview-tone-btn').addEventListener('click',()=>playSyntheticSpeech(true));
byId('play-pause-btn').addEventListener('click',()=>{if(!realAudio.paused)realAudio.pause();else playCurrent()});
byId('progress-container').addEventListener('click',e=>{
 if(!Number.isFinite(realAudio.duration))return;const rect=e.currentTarget.getBoundingClientRect();realAudio.currentTime=Math.max(0,Math.min(realAudio.duration,(e.clientX-rect.left)/rect.width*realAudio.duration));syncTransport();
});
['timeupdate','loadedmetadata','play','pause','ended'].forEach(type=>realAudio.addEventListener(type,syncTransport));
realAudio.addEventListener('error',()=>setStatus('The audio could not be played. Try selecting the clip again.',true));
byId('studio-audio-select').addEventListener('change',e=>{const a=hostAssets.find(a=>a.id===e.target.value);if(a){showAsset(a);playCurrent()}});
byId('studio-profile-select').addEventListener('change',updateProfiles);
byId('studio-voice-preview').addEventListener('click',()=>{const a=hostAssets.find(a=>a.id===selectedProfile?.asset);if(a){showAsset(a);playCurrent()}else setStatus('Select a voice with a reference recording first.',true)});
byId('studio-apply-effects').addEventListener('click',playCurrent);
byId('studio-open-editor').addEventListener('click',()=>{realAudio.pause();tellParent('open-editor',{assetId:renderedAsset?.id||sourceAsset?.id})});
document.querySelectorAll('.voice-card').forEach(card=>{
 card.addEventListener('click',()=>{byId('studio-profile-select').value='';updateProfiles();realAudio.pause();setStatus('Selected '+(selectedProfile?.name||'voice still being prepared'))});
 card.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();card.click()}});
});
byId('studio-quality').addEventListener('change',e=>{
 const enabled=e.target.value!=='still';visualPaused=!enabled;
 helixGeo.setDrawRange(0,e.target.value==='low'?600:1600);fluidGeo.setDrawRange(0,e.target.value==='low'?2500:9000);dustGeo.setDrawRange(0,e.target.value==='low'?600:1800);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,e.target.value==='high'?2:1));
});
window.addEventListener('message',event=>{
 if(event.origin!==HOST_ORIGIN||event.source!==parent||event.data?.source!=='voice-studio-host')return;
 if(event.data.type==='library'){hostProfiles=event.data.profiles;hostAssets=event.data.assets;updateProfiles();updateLibrary()}
 if(event.data.type==='suspend'){visualPaused=true;realAudio.pause();if(state.isMicActive)toggleMicrophone()}
 if(event.data.type==='resume')visualPaused=byId('studio-quality').value==='still';
});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.isZenMode)toggleZenMode()});
window.addEventListener('beforeunload',()=>{realAudio.pause();micStream?.getTracks().forEach(t=>t.stop());audioCtx?.close()});
const visibilityStyle=document.createElement('style');visibilityStyle.textContent='#zen-restore-container.opacity-0,#zen-restore-container.opacity-0 button{pointer-events:none!important}html,body{height:100%;overflow:hidden!important}#main-content{overflow-y:auto!important;min-height:0;flex:1}';document.head.appendChild(visibilityStyle);
byId('play-pause-btn').setAttribute('aria-label','Play or pause audio');
for(const [id,label] of [['param-pitch','Base pitch'],['param-timbre','Timbre color'],['param-vibrato','Vibrato flux'],['param-drift','Fluid curl force']])byId(id).setAttribute('aria-label',label);
// Parent shell follows the original Zen toggle while retaining the floating restore control.
const originalZen = toggleZenMode;
toggleZenMode=function(){originalZen();tellParent('zen',{enabled:state.isZenMode})};
// Existing click listeners retain their original function reference; observe the HUD state too.
new MutationObserver(()=>tellParent('zen',{enabled:state.isZenMode})).observe(byId('main-header'),{attributes:true,attributeFilter:['class']});
state.vibrato=0;byId('param-vibrato').value=0;byId('val-vibrato').textContent='0%';
if(matchMedia('(prefers-reduced-motion: reduce)').matches){visualPaused=true;byId('studio-quality').value='still'}
setStatus('Select a character or your own saved voice.');
byId('char-count').textContent=byId('speech-script').value.length+' characters';
byId('speech-script').addEventListener('input',()=>{byId('char-count').textContent=byId('speech-script').value.length+' characters'});
tellParent('ready');
