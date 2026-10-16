import React, {useEffect, useMemo, useRef, useState} from 'react';
import reference from './immersive/reference.html?raw';
import visuals from './immersive/visual-runtime.js?raw';
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

function makeDocument() {
 const controls = `<div id="studio-controls">
 <label>Saved audio<select id="studio-audio-select"><option value="">Choose a recording…</option></select></label>
 <label>Language<select id="studio-language">${['Auto','English','Chinese','Japanese','Korean','German','French','Russian','Portuguese','Spanish','Italian'].map(v=>`<option>${v}</option>`).join('')}</select></label>
 <button id="studio-play">Play / pause</button><button id="studio-apply-effects">Apply voice shaping</button>
 <button id="studio-open-editor">Recorder &amp; editor ↗</button>
 <label>Visuals<select id="studio-quality"><option value="high">Full</option><option value="low">Light</option><option value="still">Still</option></select></label>
 <a id="studio-download" download hidden>Download WAV ↗</a></div>
 <p id="studio-live-status" role="status" aria-live="polite"></p><span id="studio-audio-name"></span>`;
 const form = `<input id="studio-file" type="file" accept=".wav,.mp3,.flac,audio/*" hidden>
 <label>Reference recording<select id="reference-asset"><option value="">Import or choose audio…</option></select></label>
 <label>Voice name<input id="reference-name" maxlength="100" value="My voice"></label>
 <label>Exact transcript<textarea id="reference-transcript" rows="2" placeholder="Type exactly what is spoken in the reference recording."></textarea></label>
 <button id="studio-save-profile">Save voice reference</button><p class="studio-hint">Use a clean 3–15 second sample. Saving creates a local Qwen3-TTS reference.</p>`;
 const css = `${sans400+sans500+sans600+sans700+mono400+mono500+mono600+utilityCSS}
 html,body{height:100%;overflow:hidden!important}#main-content{overflow-y:auto!important;min-height:0;flex:1}button:disabled{opacity:.4;cursor:wait}button:focus-visible,[role=button]:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #e2e8f0;outline-offset:3px}#studio-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap}#studio-controls label{font-size:10px;color:#a1a1aa}#studio-controls select{display:block}#studio-controls button,#studio-controls a,#studio-controls select,#view-clone input,#view-clone textarea,#view-clone select,#studio-save-profile{background:#0b0e14;border:1px solid #ffffff26;border-radius:8px;color:#d4d4d8;padding:8px 10px;font-size:11px}#view-clone label{font-size:11px;color:#a1a1aa}#view-clone label>*{display:block;width:100%;margin:5px 0}#studio-live-status,#studio-audio-name,.studio-hint{font-size:11px;color:#a1a1aa;min-height:16px;overflow-wrap:anywhere}#zen-restore-container.opacity-0{pointer-events:none!important}.remove-track{opacity:1!important}#audio-dropzone:focus-visible{outline:2px solid white}.voice-card[aria-disabled=true]{opacity:.55} @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`;
 let html=reference.replace('</head>',`<base href="${window.location.origin}/"><style>${css}</style><script src="${threeURL}"></script><script src="${lucideURL}"></script></head>`);
 html=html.replace('<!-- Live synthesis progress & interactive visual scrub bar -->',controls+'<!-- Live synthesis progress & interactive visual scrub bar -->');
 const cloneStart=html.indexOf('<div id="view-clone"');
 const controlsStart=html.indexOf('<div id="studio-controls">',cloneStart);
 const tabEnd=html.lastIndexOf('</div>',controlsStart);
 html=html.slice(0,tabEnd)+form+html.slice(tabEnd);
 return html.replace('</body>',`<script>const HOST_ORIGIN=${JSON.stringify(window.location.origin)};\n${visuals}\n${bridge}</script></body>`);
}
export default function AuraStudio({assets,profiles,onAsset,onRefresh,onEditor,active,onZen,onPlayback,onBusy}) {
 const frame=useRef(),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const doc=useMemo(makeDocument,[]);
 const callbacks=useRef();callbacks.current={onAsset,onRefresh,onEditor,onZen,onPlayback,onBusy};
 const send=payload=>frame.current?.contentWindow?.postMessage({source:'voice-studio-host',...payload},window.location.origin);
 useEffect(()=>{
  const listener=e=>{
   if(e.origin!==window.location.origin||e.source!==frame.current?.contentWindow||e.data?.source!=='voice-studio-stage')return;
   const {type}=e.data;
   if(type==='ready')setReady(true);
   if(type==='asset-created')callbacks.current.onAsset(e.data.asset);
   if(type==='refresh')callbacks.current.onRefresh();
   if(type==='open-editor')callbacks.current.onEditor(e.data.assetId);
   if(type==='zen')callbacks.current.onZen(e.data.enabled);
   if(type==='playing')callbacks.current.onPlayback();
   if(type==='busy')callbacks.current.onBusy(e.data.enabled);
  };
  window.addEventListener('message',listener);
  const timeout=setTimeout(()=>setFailed(true),15000);
  return()=>{clearTimeout(timeout);window.removeEventListener('message',listener)};
 },[]);
 useEffect(()=>{if(ready)send({type:'library',assets,profiles})},[ready,assets,profiles]);
 useEffect(()=>{if(ready)send({type:active?'resume':'suspend'})},[active,ready]);
 return <div className="immersive-stage" hidden={!active}>
 {!ready&&<div className="stage-loading" role="status">{failed?'The immersive view could not load. Use Recorder & editor above.':'Opening your studio…'}</div>}
 <iframe ref={frame} title="AuraVoice immersive studio" srcDoc={doc} allow="microphone; autoplay"/>
 </div>;
}
