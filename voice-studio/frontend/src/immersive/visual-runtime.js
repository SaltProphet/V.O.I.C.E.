/* Presentation only: one explicit animation scheduler, no generation or library APIs. */
const canvas=document.getElementById('scene'),audio=document.getElementById('audio');
const tell=(type,data={})=>parent.postMessage({source:'voice-studio-visual',type,...data},HOST_ORIGIN);
let motion=false,frame=null,disposed=false,ctx=null,analyser=null,source=null,zen=false;
let renderer=null,points=null,geometry=null,material=null;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.z=10;
const count=1600,positions=new Float32Array(count*3),bins=new Uint8Array(256);
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});renderer.setClearColor(0x07090d);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));material=new THREE.PointsMaterial({color:0xa9dcd1,size:.035});points=new THREE.Points(geometry,material);scene.add(points)}catch(e){document.getElementById('error').textContent='WebGL unavailable. Recording playback remains available.'}
window.__visualStats={frames:0,pending:false,motion:false,disposed:false};
function cancel(){if(frame!==null)cancelAnimationFrame(frame);frame=null;window.__visualStats.pending=false}
function schedule(){if(!disposed&&!document.hidden&&frame===null){frame=requestAnimationFrame(tick);window.__visualStats.pending=true}}
function draw(time){
 window.__visualStats.frames++;
 if(!renderer)return;
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix()}
 if(analyser&&!audio.paused)analyser.getByteFrequencyData(bins);else bins.fill(0);
 const kind=document.getElementById('appearance').value,t=motion?time/1000:0;
 for(let i=0;i<count;i++){const n=i/count,a=n*Math.PI*24+t,energy=bins[i%256]/255;
 if(kind==='helix'){positions[i*3]=Math.sin(a)*(1+energy);positions[i*3+1]=(n-.5)*7;positions[i*3+2]=Math.cos(a)}
 else if(kind==='fluid'){positions[i*3]=(n-.5)*12;positions[i*3+1]=Math.sin(n*30+t)*(1+energy);positions[i*3+2]=Math.cos(n*80+t)*.8}
 else{positions[i*3]=Math.sin(i*127.1)*(4+energy);positions[i*3+1]=Math.cos(i*311.7+t*.1)*3;positions[i*3+2]=Math.sin(i*74.7)*3}
 }geometry.attributes.position.needsUpdate=true;points.rotation.y=motion?t*.1:0;renderer.render(scene,camera);
}
function tick(time){frame=null;window.__visualStats.pending=false;if(disposed||document.hidden)return;draw(time);if(motion)schedule()}
function setMotion(value){motion=value;window.__visualStats.motion=motion;cancel();document.getElementById('motion').textContent=motion?'Motion on':'Motion off';document.getElementById('motion').setAttribute('aria-pressed',String(motion));schedule()}
function setZen(value){zen=value;document.getElementById('zen').textContent=zen?'Show interface · Esc':'Zen view';tell('zen',{enabled:zen});schedule()}
function visibility(){cancel();if(document.hidden){audio.pause();ctx?.suspend()}else{if(!audio.paused)ctx?.resume();schedule()}}
function dispose(){if(disposed)return;disposed=true;cancel();audio.pause();audio.removeAttribute('src');audio.load();source?.disconnect();analyser?.disconnect();ctx?.close();geometry?.dispose();material?.dispose();renderer?.dispose();renderer?.forceContextLoss();observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.__visualStats.disposed=true}
const observer=new ResizeObserver(()=>schedule());observer.observe(canvas);
document.getElementById('motion').onclick=()=>setMotion(!motion);
document.getElementById('appearance').onchange=()=>schedule();
document.getElementById('zen').onclick=()=>setZen(!zen);
window.addEventListener('keydown',e=>{if(e.key==='Escape')setZen(false)});
document.addEventListener('visibilitychange',visibility);
audio.onplay=async()=>{tell('playing');try{if(!ctx){ctx=new AudioContext();source=ctx.createMediaElementSource(audio);analyser=ctx.createAnalyser();analyser.fftSize=512;source.connect(analyser).connect(ctx.destination)}await ctx.resume();schedule()}catch(e){document.getElementById('error').textContent=e.message}};
audio.onpause=()=>schedule();audio.onerror=()=>{if(audio.getAttribute('src'))document.getElementById('error').textContent='Unable to play selected recording.'};
window.addEventListener('message',e=>{if(e.origin!==HOST_ORIGIN||e.source!==parent||e.data?.source!=='voice-studio-host')return;const d=e.data;if(d.type==='asset'){audio.pause();const a=d.asset;document.getElementById('name').textContent=a?a.name:'Choose a recording in the studio to play it here.';if(a)audio.src=HOST_ORIGIN+'/api/assets/'+a.id+'/audio';else audio.removeAttribute('src');schedule()}if(d.type==='zen'&&zen!==d.enabled)setZen(d.enabled);if(d.type==='dispose')dispose()});
window.addEventListener('pagehide',dispose);window.addEventListener('beforeunload',dispose);
window.__disposeVisual=dispose;
schedule();tell('ready');
