import React,{useEffect,useMemo,useRef,useState} from 'react';
import reference from './immersive/reference.html?raw';
import bridge from './immersive/bridge.js?raw';
import utilityCSS from './immersive/utilities.css?inline';
import threeURL from 'three/build/three.min.js?url';
import lucideURL from 'lucide/dist/umd/lucide.min.js?url';
import sans400 from '@fontsource/plus-jakarta-sans/400.css?inline';
import sans500 from '@fontsource/plus-jakarta-sans/500.css?inline';
import sans600 from '@fontsource/plus-jakarta-sans/600.css?inline';
import sans700 from '@fontsource/plus-jakarta-sans/700.css?inline';
import mono400 from '@fontsource/jetbrains-mono/400.css?inline';
import mono500 from '@fontsource/jetbrains-mono/500.css?inline';
import mono600 from '@fontsource/jetbrains-mono/600.css?inline';

function makeDocument(){
 let html=reference.replace(/<script src="[^"]+"><\/script>/g,'').replace(/@import url\([^;]+;/g,'').replaceAll('AuraVoice','Voice Studio');
 let begin=html.lastIndexOf('<script>'),end=html.lastIndexOf('</script>');
 let script=html.slice(begin+8,end);
 script=script.replace('function playSyntheticSpeech(previewOnly = false)','function playCarrierTone(previewOnly = false)');
 script=script.replaceAll('state.vibrato = 18;','state.vibrato = 0;').replaceAll('vibratoSlider.value = 18;','vibratoSlider.value = 0;').replaceAll("textContent = '18%'","textContent = '0%'");
 script=script.replace("e.target.tagName === 'INPUT'", "e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.repeat");
 script=script.replace(/    synthBtn\.addEventListener\('click',[\s\S]*?(?=    function updatePlaybackUI)/,'');
 script=script.replace(/    progressContainer\.addEventListener\('click',[\s\S]*?(?=    \/\/ Toast Alert Notification)/,'');
 script=script.replace(/        if \(state\.isPlaying\) \{\s*playSyntheticSpeech\(\);\s*\}/,'');
 script=script.replace('      const delta = clock.getDelta();',"      if (visualPaused || document.hidden) return;\n      const delta = clock.getDelta();");
 script=script.replace('      const intensity = state.audioIntensity;',"      const intensity = state.audioIntensity;");
 script=script.replace('      // Smooth gradual intensity interpolation',`      if (!realAudio.paused && outputAnalyser) {
        outputAnalyser.getByteFrequencyData(frequencyData);
        outputAnalyser.getFloatTimeDomainData(timeData);
        const rms=Math.sqrt(timeData.reduce((sum,x)=>sum+x*x,0)/timeData.length);
        state.targetIntensity=Math.min(1,rms*5);
        const meter=byId('energy-gauge-label');if(meter)meter.textContent=(20*Math.log10(Math.max(rms,.00001))).toFixed(1)+' dBFS';
      } else if (!state.isMicActive && !state.isPlaying) state.targetIntensity=.04;
      // Smooth gradual intensity interpolation`);
 script=script.replace('`${(state.audioIntensity * 10).toFixed(2)} dB`',"(!realAudio.paused ? byId('energy-gauge-label').textContent : 'Ambient')");
 script=script.replace('Math.abs(Math.sin(i * 0.28 + wavePhase * 2.4) * Math.cos(i * 0.14)) * (h * 0.65) * (0.15 + intensity)',"((state.isMicActive&&micDataArray?micDataArray[Math.floor(i*micDataArray.length/barCount)]:frequencyData&&!realAudio.paused?frequencyData[Math.floor(i*frequencyData.length/barCount)]:0)/255)*(h*.85)");
 script=script.replace("const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, alpha: false, antialias: true, powerPreference: 'high-performance' });",`const renderer=(()=>{try{return new THREE.WebGLRenderer({canvas:canvas3d,alpha:false,antialias:true,powerPreference:'default'})}catch(error){console.warn('WebGL unavailable; audio and 2D visuals remain available.');return{setPixelRatio(){},setSize(){},setClearColor(){},render(){}}}})();`);
 script=script.replace("showToast('Monochrome acoustic matrix active. Press [Space] for Zen View.');","showToast('Your studio is ready. Press H for Zen View.');");
 html=html.slice(0,begin)+'<script>'+script+'\nconst HOST_ORIGIN='+JSON.stringify(window.location.origin)+';\n'+bridge+'</script>'+html.slice(end+9);
 html=html.replace('</head>',`<base href="${window.location.origin}/"><style>${sans400+sans500+sans600+sans700+mono400+mono500+mono600+utilityCSS}
html,body{height:100%;min-height:100%;}body{overflow-y:auto!important;}button:disabled{opacity:.4;cursor:wait}button:focus-visible,[role=button]:focus-visible,select:focus-visible{outline:2px solid #e2e8f0;outline-offset:3px}#studio-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}#studio-controls select{flex:1;min-width:150px;background:#080b10;border:1px solid #ffffff22;border-radius:8px;color:#cbd5e1;padding:8px;font-size:11px}#studio-controls button,#studio-controls a{padding:7px 10px;border:1px solid #ffffff22;border-radius:8px;font-size:11px;color:#cbd5e1;background:#121720}#studio-live-status{font-size:11px;margin-top:8px;min-height:18px;overflow-wrap:anywhere}#studio-controls label{color:#a1a1aa;font-size:10px;display:flex;align-items:center;gap:4px}#studio-controls label select{min-width:65px}main{min-height:0}#main-content{overflow-y:visible!important;padding-top:16px;padding-bottom:16px}#waveform-canvas{height:100%}
</style><script src="${threeURL}"></script><script src="${lucideURL}"></script></head>`);
 html=html.replace('<!-- Action Buttons -->',`<!-- Action Buttons -->`);
 html=html.replace('<!-- Live synthesis progress & interactive visual scrub bar -->',`<div id="studio-controls">
<select id="studio-profile-select" aria-label="Saved voice"><option value="">Use selected character</option></select>
<button id="studio-voice-preview">Preview voice</button>
<select id="studio-audio-select" aria-label="Audio library"><option value="">Choose audio to play or shape…</option></select>
<button id="studio-apply-effects">Apply &amp; preview FX</button>
<button id="studio-open-editor" disabled>Open in editor ↗</button>
<a id="studio-download" download hidden>Download WAV ↗</a>
<label>Visuals<select id="studio-quality" aria-label="Visual quality"><option value="high">Full</option><option value="low">Light</option><option value="still">Still</option></select></label>
</div><p id="studio-live-status" role="status"></p><span id="studio-audio-name" class="text-xs text-zinc-500"></span>
<!-- Live synthesis progress & interactive visual scrub bar -->`);
 return html;
}
export default function AuraStudio({assets,profiles,onAsset,onEditor,active,onZen}){
 const frame=useRef(),[ready,setReady]=useState(false);
 const doc=useMemo(makeDocument,[]);
 const callbacks=useRef({onAsset,onEditor,onZen});callbacks.current={onAsset,onEditor,onZen};
 const send=payload=>frame.current?.contentWindow?.postMessage({source:'voice-studio-host',...payload},window.location.origin);
 useEffect(()=>{const listener=e=>{
  if(e.origin!==window.location.origin||e.source!==frame.current?.contentWindow||e.data?.source!=='voice-studio-stage')return;
  if(e.data.type==='ready')setReady(true);
  if(e.data.type==='asset-created')callbacks.current.onAsset(e.data.asset);
  if(e.data.type==='open-editor')callbacks.current.onEditor(e.data.assetId);
  if(e.data.type==='zen')callbacks.current.onZen(e.data.enabled);
 };window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener)},[]);
 useEffect(()=>{if(ready)send({type:'library',assets,profiles})},[ready,assets,profiles]);
 useEffect(()=>{if(ready)send({type:active?'resume':'suspend'})},[active,ready]);
 return <div className="immersive-stage" hidden={!active}>{!ready&&<div className="stage-loading">Opening your studio…</div>}<iframe ref={frame} title="Immersive Voice Studio" srcDoc={doc} allow="microphone; autoplay"/></div>;
}
