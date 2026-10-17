import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import threeURL from 'three/build/three.min.js?url';
import runtime from './immersive/visual-runtime.js?raw';

export default function AuraStudio({asset,onZen,zen,onPlayback}){
 const frame=useRef(),[ready,setReady]=useState(false),callbacks=useRef();callbacks.current={onZen,onPlayback};
 const send=data=>frame.current?.contentWindow?.postMessage({source:'voice-studio-host',...data},location.origin);
 const doc=useMemo(()=>`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 *{box-sizing:border-box}html,body{margin:0;background:#07090d;color:#e9edf4;font:14px system-ui}body{overflow:hidden;height:100vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto auto}header{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px}button,select{background:#1a212c;color:#eee;border:1px solid #566070;border-radius:7px;padding:8px}button:focus-visible,select:focus-visible{outline:2px solid #9fecd5}canvas{display:block;width:100%;height:100%;min-height:0}p{margin:8px 12px;font-size:12px}audio{width:100%;height:32px}label{display:flex;gap:8px;align-items:center}@media(max-width:600px){header{gap:6px;padding:8px}}
 </style><script src="${threeURL}"></script></head><body><header><label>Visual appearance<select id="appearance"><option value="helix">Helix</option><option value="fluid">Fluid</option><option value="dust">Dust</option></select></label><button id="motion" aria-pressed="false">Motion off</button><button id="zen">Zen view</button></header><canvas id="scene" aria-label="Audio reactive visual scene"></canvas><p id="name">Choose a recording in the studio to play it here.</p><audio id="audio" controls></audio><p id="error" role="alert"></p><script>const HOST_ORIGIN=${JSON.stringify(location.origin)};${runtime}</script></body></html>`,[]);
 useLayoutEffect(()=>{const win=frame.current?.contentWindow;return()=>{try{win?.__disposeVisual?.()}catch{}}},[]);
 useEffect(()=>{const listener=e=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||e.data?.source!=='voice-studio-visual')return;if(e.data.type==='ready')setReady(true);if(e.data.type==='playing')callbacks.current.onPlayback();if(e.data.type==='zen')callbacks.current.onZen(e.data.enabled)};window.addEventListener('message',listener);return()=>{send({type:'dispose'});window.removeEventListener('message',listener)}},[]);
 useEffect(()=>{if(ready)send({type:'asset',asset})},[ready,asset]);
 useEffect(()=>{if(ready)send({type:'zen',enabled:zen})},[ready,zen]);
 return <section className={'visual-shell '+(zen?'visual-zen':'')}><iframe ref={frame} title="Voice Studio Visual mode" srcDoc={doc} allow="autoplay"/></section>;
}
