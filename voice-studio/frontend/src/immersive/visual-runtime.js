
    /* Initialize Feather/Lucide Icons */
    lucide.createIcons();

    // Application state
    const state = {
      isPlaying: false,
      isMicActive: false,
      isZenMode: false,
      isExtracting: false,
      viewMode: 'combined', // 'combined', 'freq', 'dna'
      selectedVoice: 'nova',
      pitch: 1.0,
      speed: 0.65,
      vibrato: 0,
      timbreShift: 50,
      curlForce: 0.75,
      simulationMode: 0,
      audioIntensity: 0.04,
      targetIntensity: 0.04,
      currentTime: 0,
      totalDuration: 0.1,
      // Color interpolation targets
      currentColorA: new THREE.Color('#f8fafc'),
      currentColorB: new THREE.Color('#94a3b8'),
      targetColorA: new THREE.Color('#f8fafc'),
      targetColorB: new THREE.Color('#94a3b8'),
      bgTargetColor: new THREE.Color('#030407')
    };

    // Archetype definitions with AI TTS Voice Mapping
    const voiceProfiles = {
      nova: {
        name: 'Nova Prime',
        paletteName: 'Platinum White',
        basePitch: 1.0, baseFreq: 440, formantShift: 0.0,
        colorHex: '#f8fafc', colorSecondary: '#cbd5e1', chromaHue: 'platinum',
        ambientGlow1: 'rgba(248, 250, 252, 0.07)', ambientGlow2: 'rgba(203, 213, 225, 0.04)',
        panelBorder: 'rgba(255, 255, 255, 0.12)', panelBg: 'rgba(8, 10, 16, 0.78)',
        siteGlowRgb: '248, 250, 252', bodyBg: '#030407', themeBtnGrad: 'from-zinc-200 via-white to-zinc-300',
        ttsVoice: 'Zephyr' // Bright, clear voice
      },
      atlas: {
        name: 'Atlas Deep',
        paletteName: 'Obsidian Bronze',
        basePitch: 0.75, baseFreq: 210, formantShift: -4.2,
        colorHex: '#d8b48c', colorSecondary: '#785c42', chromaHue: 'obsidian',
        ambientGlow1: 'rgba(216, 180, 140, 0.08)', ambientGlow2: 'rgba(120, 92, 66, 0.05)',
        panelBorder: 'rgba(216, 180, 140, 0.16)', panelBg: 'rgba(14, 11, 9, 0.82)',
        siteGlowRgb: '216, 180, 140', bodyBg: '#060403', themeBtnGrad: 'from-[#d8b48c] via-[#ecd5be] to-[#b3916b]',
        ttsVoice: 'Charon' // Informative, deep voice
      },
      cyra: {
        name: 'Cyra Synth',
        paletteName: 'Lunar Ice Blue',
        basePitch: 1.25, baseFreq: 620, formantShift: 5.5,
        colorHex: '#93c5fd', colorSecondary: '#3b82f6', chromaHue: 'lunar',
        ambientGlow1: 'rgba(147, 197, 253, 0.09)', ambientGlow2: 'rgba(59, 130, 246, 0.05)',
        panelBorder: 'rgba(147, 197, 253, 0.16)', panelBg: 'rgba(7, 10, 18, 0.82)',
        siteGlowRgb: '147, 197, 253', bodyBg: '#02050b', themeBtnGrad: 'from-[#93c5fd] via-[#bfdbfe] to-[#60a5fa]',
        ttsVoice: 'Puck' // Upbeat, energetic voice
      },
      echo: {
        name: 'Echo ASMR',
        paletteName: 'Smoked Emerald Quartz',
        basePitch: 0.9, baseFreq: 330, formantShift: -1.8,
        colorHex: '#a7f3d0', colorSecondary: '#34d399', chromaHue: 'smoked',
        ambientGlow1: 'rgba(167, 243, 208, 0.08)', ambientGlow2: 'rgba(52, 211, 153, 0.04)',
        panelBorder: 'rgba(167, 243, 208, 0.16)', panelBg: 'rgba(5, 12, 10, 0.82)',
        siteGlowRgb: '167, 243, 208', bodyBg: '#020705', themeBtnGrad: 'from-[#a7f3d0] via-[#d1fae5] to-[#6ee7b7]',
        ttsVoice: 'Kore' // Firm, smooth voice
      }
    };

    // Global Timeline Sequence Data
    let timelineTracks = [
      { id: 1, voice: 'nova', text: 'Initializing biometric acoustic synthesis.' },
      { id: 2, voice: 'atlas', text: 'Fluid dynamics matrix is now fully stabilized.' }
    ];

    // Web Audio Synthesizer, TTS & Media Recorder
    let audioCtx = null;
    let masterAnalyser = null;
    let synthNodes = [];
    let playbackInterval = null;
    let micStream = null;
    let micDataArray = null;

    let mediaRecorder = null;
    let recordedChunks = [];
    let exportStreamDest = null;

    function getAudioContext() {
      if (!audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtx();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function getMasterAnalyser() {
      const ctx = getAudioContext();
      if (!masterAnalyser) {
        masterAnalyser = ctx.createAnalyser();
        masterAnalyser.fftSize = 512;
        masterAnalyser.smoothingTimeConstant = 0.88;
      }
      return masterAnalyser;
    }

    // Applies full-site theme changes based on selected Archetype
    function applyArchetypeColors(profile) {
      state.targetColorA = new THREE.Color(profile.colorHex);
      state.targetColorB = new THREE.Color(profile.colorSecondary);

      // Update DOM CSS Variables
      document.documentElement.style.setProperty('--chroma-primary', profile.colorHex);
      document.documentElement.style.setProperty('--chroma-secondary', profile.colorSecondary);
      
      const timbrePip = document.getElementById('timbre-color-pip');
      if (timbrePip) {
        timbrePip.style.backgroundColor = profile.colorHex;
        timbrePip.style.boxShadow = `0 0 8px ${profile.colorHex}`;
        document.getElementById('timbre-palette-name').innerHTML = `<span id="timbre-color-pip" class="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)] transition-all duration-700" style="background-color: ${profile.colorHex}; box-shadow: 0 0 8px ${profile.colorHex};"></span> ${profile.paletteName}`;
      }

      const modeBadge = document.getElementById('mode-badge');
      if (modeBadge) {
         modeBadge.style.color = profile.colorHex;
         modeBadge.style.borderColor = profile.ambientGlow1;
      }

      document.getElementById('glow-orb-1').style.background = profile.ambientGlow1;
      document.getElementById('glow-orb-2').style.background = profile.ambientGlow2;
      document.getElementById('glow-orb-3').style.background = profile.ambientGlow1;
      document.body.style.backgroundColor = profile.bodyBg;
    }

    // Zen Mode Toggle Logic
    function toggleZenMode() {
      state.isZenMode = !state.isZenMode;
      const hudLayers = document.querySelectorAll('.hud-layer');
      const zenRestore = document.getElementById('zen-restore-container');
      
      if (state.isZenMode) {
        hudLayers.forEach(el => el.classList.add('hud-hidden'));
        zenRestore.classList.remove('opacity-0', 'translate-y-[-10px]', 'pointer-events-none');
        zenRestore.classList.add('opacity-100', 'translate-y-0');
      } else {
        hudLayers.forEach(el => el.classList.remove('hud-hidden'));
        zenRestore.classList.remove('opacity-100', 'translate-y-0');
        zenRestore.classList.add('opacity-0', 'translate-y-[-10px]', 'pointer-events-none');
      }
    }

    document.getElementById('zen-toggle-btn').addEventListener('click', toggleZenMode);
    document.getElementById('zen-restore-btn').addEventListener('click', toggleZenMode);

    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in a textarea or input
      if (e.target.closest('input,textarea,select,button,a') || e.repeat) return;
      
      if (e.code === 'Space' || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        toggleZenMode();
      }
    });

    // Tab Switching Logic
    const tabTimeline = document.getElementById('tab-timeline');
    const tabClone = document.getElementById('tab-clone');
    const viewTimeline = document.getElementById('view-timeline');
    const viewClone = document.getElementById('view-clone');

    tabTimeline.addEventListener('click', () => {
      tabTimeline.className = 'text-xs font-semibold text-white border-b-2 border-white pb-2 px-1 tracking-wider uppercase';
      tabClone.className = 'text-xs font-semibold text-zinc-500 hover:text-zinc-300 pb-2 px-1 tracking-wider uppercase transition-colors';
      viewTimeline.classList.remove('hidden');
      viewClone.classList.add('hidden');
      viewClone.classList.remove('flex');
    });

    tabClone.addEventListener('click', () => {
      tabClone.className = 'text-xs font-semibold text-white border-b-2 border-white pb-2 px-1 tracking-wider uppercase';
      tabTimeline.className = 'text-xs font-semibold text-zinc-500 hover:text-zinc-300 pb-2 px-1 tracking-wider uppercase transition-colors';
      viewClone.classList.remove('hidden');
      viewClone.classList.add('flex');
      viewTimeline.classList.add('hidden');
    });

    // 3D Scene Initialization
    const canvas3d = document.getElementById('bg-webgl-canvas');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030407, 0.015);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 48);

    const renderer = (() => {try { return new THREE.WebGLRenderer({canvas: canvas3d, alpha:false, antialias:true, powerPreference:'default'}); } catch(error) { console.warn('WebGL unavailable', error); return {setPixelRatio(){},setSize(){},setClearColor(){},render(){},dispose(){}}; }})();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x030407, 1);

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    window.addEventListener('mousemove', (e) => {
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        mouse.targetX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.targetY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
      }
    }, { passive: true });

    function createGlowDotTexture() {
      const size = 64;
      const cvs = document.createElement('canvas');
      cvs.width = size;
      cvs.height = size;
      const ctx = cvs.getContext('2d');
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, 'rgba(235, 240, 248, 0.85)');
      grad.addColorStop(0.55, 'rgba(160, 170, 185, 0.28)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(cvs);
    }
    const dotTexture = createGlowDotTexture();

    // 1. DNA Double Helix
    const HELIX_POINTS = 1600;
    const helixGeo = new THREE.BufferGeometry();
    const helixPos = new Float32Array(HELIX_POINTS * 3);
    const helixColors = new Float32Array(HELIX_POINTS * 3);
    const helixInitCoords = [];

    for (let i = 0; i < HELIX_POINTS; i++) {
      const strand = i % 2 === 0 ? 0 : 1;
      const t = (i / HELIX_POINTS) * 28 - 14;
      const angle = t * 1.3 + (strand * Math.PI);
      const radius = 6.5;

      const x = Math.cos(angle) * radius;
      const y = t * 2.8;
      const z = Math.sin(angle) * radius;

      helixPos[i * 3] = x;
      helixPos[i * 3 + 1] = y;
      helixPos[i * 3 + 2] = z;

      helixInitCoords.push({ x, y, z, angle, radius, strand });

      const lum = strand === 0 ? 0.95 : 0.65;
      helixColors[i * 3] = lum;
      helixColors[i * 3 + 1] = lum;
      helixColors[i * 3 + 2] = lum;
    }

    helixGeo.setAttribute('position', new THREE.BufferAttribute(helixPos, 3));
    helixGeo.setAttribute('color', new THREE.BufferAttribute(helixColors, 3));

    const helixMaterial = new THREE.PointsMaterial({
      size: 1.35,
      map: dotTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8
    });
    const helixMesh = new THREE.Points(helixGeo, helixMaterial);
    scene.add(helixMesh);

    // DNA Connecting Harmonic Bridges
    const BRIDGES = 68;
    const bridgeGeo = new THREE.BufferGeometry();
    const bridgePositions = new Float32Array(BRIDGES * 2 * 3);
    const bridgeColors = new Float32Array(BRIDGES * 2 * 3);

    for (let i = 0; i < BRIDGES; i++) {
      const t = (i / BRIDGES) * 28 - 14;
      const angle = t * 1.3;
      const radius = 6.5;

      bridgePositions[i * 6] = Math.cos(angle) * radius;
      bridgePositions[i * 6 + 1] = t * 2.8;
      bridgePositions[i * 6 + 2] = Math.sin(angle) * radius;

      bridgePositions[i * 6 + 3] = Math.cos(angle + Math.PI) * radius;
      bridgePositions[i * 6 + 4] = t * 2.8;
      bridgePositions[i * 6 + 5] = Math.sin(angle + Math.PI) * radius;

      bridgeColors[i * 6] = 0.8;
      bridgeColors[i * 6 + 1] = 0.8;
      bridgeColors[i * 6 + 2] = 0.8;
      bridgeColors[i * 6 + 3] = 0.45;
      bridgeColors[i * 6 + 4] = 0.45;
      bridgeColors[i * 6 + 5] = 0.45;
    }

    bridgeGeo.setAttribute('position', new THREE.BufferAttribute(bridgePositions, 3));
    bridgeGeo.setAttribute('color', new THREE.BufferAttribute(bridgeColors, 3));

    const bridgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending
    });
    const bridgeMesh = new THREE.LineSegments(bridgeGeo, bridgeMaterial);
    scene.add(bridgeMesh);

    // 2. Fluid Dynamics Swirling Curl Particles
    const FLUID_COUNT = 9000;
    const fluidGeo = new THREE.BufferGeometry();
    const fluidPos = new Float32Array(FLUID_COUNT * 3);
    const fluidColors = new Float32Array(FLUID_COUNT * 3);
    const fluidBaseTints = [];

    for (let i = 0; i < FLUID_COUNT; i++) {
      const r = Math.pow(Math.random(), 0.5) * 36;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 64;

      fluidPos[i * 3] = Math.cos(theta) * r;
      fluidPos[i * 3 + 1] = y;
      fluidPos[i * 3 + 2] = Math.sin(theta) * r;

      const lum = 0.3 + Math.random() * 0.65;
      fluidColors[i * 3] = lum;
      fluidColors[i * 3 + 1] = lum;
      fluidColors[i * 3 + 2] = lum;
      fluidBaseTints.push(lum);
    }

    fluidGeo.setAttribute('position', new THREE.BufferAttribute(fluidPos, 3));
    fluidGeo.setAttribute('color', new THREE.BufferAttribute(fluidColors, 3));

    const fluidMaterial = new THREE.PointsMaterial({
      size: 1.15,
      map: dotTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.65
    });
    const fluidMesh = new THREE.Points(fluidGeo, fluidMaterial);
    scene.add(fluidMesh);

    // 3. Atmospheric Floating Cosmic Dust Motes
    const DUST_COUNT = 1800;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST_COUNT * 3);
    const dustPhase = new Float32Array(DUST_COUNT);

    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 110;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 95;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 95;
      dustPhase[i] = Math.random() * Math.PI * 2;
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMaterial = new THREE.PointsMaterial({
      size: 0.75,
      color: 0xd4d4d8,
      transparent: true,
      opacity: 0.3,
      map: dotTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const dustMesh = new THREE.Points(dustGeo, dustMaterial);
    scene.add(dustMesh);

    function getCurlNoise(x, y, z, time, turbulence) {
      const freq = 0.05 * turbulence;
      const u = Math.sin(y * freq + time * 0.3) + Math.cos(z * freq + time * 0.22);
      const v = Math.sin(z * freq + time * 0.28) + Math.cos(x * freq + time * 0.35);
      const w = Math.sin(x * freq + time * 0.22) + Math.cos(y * freq + time * 0.28);
      return { x: u * 0.065, y: v * 0.065, z: w * 0.065 };
    }
    const waveCanvas = document.getElementById('waveform-canvas');
    const waveCtx = waveCanvas.getContext('2d');

    function resizeWaveCanvas() {
      waveCanvas.width = waveCanvas.parentElement.clientWidth * window.devicePixelRatio;
      waveCanvas.height = waveCanvas.parentElement.clientHeight * window.devicePixelRatio;
    }
    window.addEventListener('resize', resizeWaveCanvas);
    resizeWaveCanvas();

    let wavePhase = 0;
    function render2DWaveform() {
      const w = waveCanvas.width;
      const h = waveCanvas.height;
      waveCtx.clearRect(0, 0, w, h);

      waveCtx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      waveCtx.lineWidth = 1;
      const gridGap = 32 * window.devicePixelRatio;
      for (let x = 0; x < w; x += gridGap) {
        waveCtx.beginPath(); waveCtx.moveTo(x, 0); waveCtx.lineTo(x, h); waveCtx.stroke();
      }
      for (let y = 0; y < h; y += gridGap) {
        waveCtx.beginPath(); waveCtx.moveTo(0, y); waveCtx.lineTo(w, y); waveCtx.stroke();
      }

      const intensity = state.audioIntensity;
      const midY = h / 2;
      const activeColor = voiceProfiles[state.selectedVoice].colorHex;

      if (state.viewMode === 'combined') {
        const waveCount = 5;
        for (let wave = 0; wave < waveCount; wave++) {
          waveCtx.beginPath();
          const alpha = 0.15 + (wave / waveCount) * 0.75;
          waveCtx.strokeStyle = wave === waveCount - 1 ? activeColor : `rgba(255, 255, 255, ${alpha * 0.35})`;
          waveCtx.lineWidth = (wave === waveCount - 1 ? 2.0 : 1.0) * window.devicePixelRatio;
          const speed = (wave + 1) * 0.45;
          const amp = (14 + wave * 7) * window.devicePixelRatio * (0.18 + intensity * 1.5);
          const freqMultiplier = 0.007 + wave * 0.003;
          for (let x = 0; x < w; x += 3) {
            const envelope = Math.sin((x / w) * Math.PI);
            const y = midY + Math.sin(x * freqMultiplier + wavePhase * speed) * amp * envelope + Math.cos(x * 0.015 - wavePhase * 0.7) * (amp * 0.3) * envelope;
            if (x === 0) waveCtx.moveTo(x, y); else waveCtx.lineTo(x, y);
          }
          waveCtx.stroke();
        }
      } else if (state.viewMode === 'freq') {
        const barCount = 48;
        const barWidth = (w / barCount) - 4 * window.devicePixelRatio;
        for (let i = 0; i < barCount; i++) {
          const barHeight = micDataArray && (state.isMicActive || state.isPlaying) ? micDataArray[Math.floor(i * micDataArray.length / barCount)] / 255 * h * .85 : 0;
          const x = i * (barWidth + 4 * window.devicePixelRatio) + 2 * window.devicePixelRatio;
          const y = h - barHeight - 10 * window.devicePixelRatio;
          const grad = waveCtx.createLinearGradient(0, y, 0, h);
          grad.addColorStop(0, activeColor);
          grad.addColorStop(0.6, voiceProfiles[state.selectedVoice].colorSecondary);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
          waveCtx.fillStyle = grad;
          waveCtx.fillRect(x, y, barWidth, barHeight);
        }
      } else {
        const nodes = 36;
        for (let i = 0; i < nodes; i++) {
          const t = i / nodes; const x = t * w;
          const y1 = midY + Math.sin(t * Math.PI * 4 + wavePhase * 1.4) * (36 * window.devicePixelRatio * (0.25 + intensity));
          const y2 = midY + Math.sin(t * Math.PI * 4 + wavePhase * 1.4 + Math.PI) * (36 * window.devicePixelRatio * (0.25 + intensity));
          waveCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; waveCtx.lineWidth = 1 * window.devicePixelRatio;
          waveCtx.beginPath(); waveCtx.moveTo(x, y1); waveCtx.lineTo(x, y2); waveCtx.stroke();
          waveCtx.fillStyle = activeColor; waveCtx.beginPath(); waveCtx.arc(x, y1, 2.5 * window.devicePixelRatio, 0, Math.PI * 2); waveCtx.fill();
          waveCtx.fillStyle = '#71717a'; waveCtx.beginPath(); waveCtx.arc(x, y2, 2.5 * window.devicePixelRatio, 0, Math.PI * 2); waveCtx.fill();
        }
      }
      wavePhase += 0.018 * (0.6 + intensity * 1.2);
    }
    
    let clock = new THREE.Clock();

    let visualFrameRendered = false;
    function animate() {
      requestAnimationFrame(animate);

      if (document.hidden || (visualPaused && visualFrameRendered)) { clock.getDelta(); return; }
      visualFrameRendered = true;
      const delta = clock.getDelta();
      const time = clock.getElapsedTime() * 0.7;

      if (masterAnalyser && micDataArray && (state.isMicActive || state.isPlaying)) {
        (state.isMicActive ? inputAnalyser : masterAnalyser).getByteFrequencyData(micDataArray);
        let sum = 0;
        for (let i = 0; i < micDataArray.length; i++) sum += micDataArray[i];
        const avg = sum / micDataArray.length;
        const normalized = Math.min(1.0, avg / 95);
        state.targetIntensity = Math.max(0.04, normalized * 0.85); 
      } else if (!state.isPlaying && !state.isMicActive) {
        state.targetIntensity = 0.04;
      }

      state.audioIntensity += (state.targetIntensity - state.audioIntensity) * 0.045;

      state.currentColorA.lerp(state.targetColorA, 0.035);
      state.currentColorB.lerp(state.targetColorB, 0.035);

      mouse.x += (mouse.targetX - mouse.x) * 0.035;
      mouse.y += (mouse.targetY - mouse.y) * 0.035;

      const helixPositionsAttr = helixGeo.attributes.position;
      const helixPositions = helixPositionsAttr.array;
      const helixColorsAttr = helixGeo.attributes.color;
      const helixCol = helixColorsAttr.array;
      let helixSpeed = (0.16 + state.audioIntensity * 0.45) * state.speed;
      
      if (state.isExtracting) helixSpeed *= 12.0;

      for (let i = 0; i < HELIX_POINTS; i++) {
        const init = helixInitCoords[i];
        const currentAngle = init.angle + time * helixSpeed;
        const breathRadius = init.radius + Math.sin(time * 1.8 + init.y * 0.25) * (0.3 + state.audioIntensity * 1.4);
        helixPositions[i * 3] = Math.cos(currentAngle) * breathRadius;
        helixPositions[i * 3 + 1] = init.y;
        helixPositions[i * 3 + 2] = Math.sin(currentAngle) * breathRadius;
        const col = init.strand === 0 ? state.currentColorA : state.currentColorB;
        helixCol[i * 3] = col.r * (0.7 + state.audioIntensity * 0.3);
        helixCol[i * 3 + 1] = col.g * (0.7 + state.audioIntensity * 0.3);
        helixCol[i * 3 + 2] = col.b * (0.7 + state.audioIntensity * 0.3);
      }
      helixPositionsAttr.needsUpdate = true;
      helixColorsAttr.needsUpdate = true;

      const bridgePosAttr = bridgeGeo.attributes.position;
      const bridgePos = bridgePosAttr.array;
      for (let i = 0; i < BRIDGES; i++) {
        const t = (i / BRIDGES) * 28 - 14;
        const currentAngle = t * 1.3 + time * helixSpeed;
        const r = 6.5 + Math.sin(time * 1.8 + t * 0.25) * (0.3 + state.audioIntensity * 1.4);
        bridgePos[i * 6] = Math.cos(currentAngle) * r;
        bridgePos[i * 6 + 1] = t * 2.8;
        bridgePos[i * 6 + 2] = Math.sin(currentAngle) * r;
        bridgePos[i * 6 + 3] = Math.cos(currentAngle + Math.PI) * r;
        bridgePos[i * 6 + 4] = t * 2.8;
        bridgePos[i * 6 + 5] = Math.sin(currentAngle + Math.PI) * r;
      }
      bridgePosAttr.needsUpdate = true;

      helixMesh.rotation.y = time * 0.04 + mouse.x * 0.25;
      helixMesh.rotation.z = Math.sin(time * 0.12) * 0.08 + mouse.y * 0.12;
      bridgeMesh.rotation.y = helixMesh.rotation.y;
      bridgeMesh.rotation.z = helixMesh.rotation.z;

      const fluidPosAttr = fluidGeo.attributes.position;
      const fPos = fluidPosAttr.array;
      const fluidColAttr = fluidGeo.attributes.color;
      const fCol = fluidColAttr.array;
      const turbulence = state.curlForce;

      for (let i = 0; i < FLUID_COUNT; i++) {
        const idx = i * 3;
        const px = fPos[idx], py = fPos[idx + 1], pz = fPos[idx + 2];
        const curl = getCurlNoise(px, py, pz, time, turbulence);
        const distToCenter = Math.sqrt(px * px + pz * pz) + 0.001;
        const vortexAngle = Math.atan2(pz, px) + (0.18 / distToCenter) * (0.5 + state.audioIntensity * 0.9);
        const vortexR = distToCenter + (Math.sin(py * 0.08 + time * 0.5) * 0.025);

        fPos[idx] = Math.cos(vortexAngle) * vortexR + curl.x * (0.35 + state.audioIntensity * 0.6);
        fPos[idx + 1] += curl.y * 0.45 - (0.012 + state.audioIntensity * 0.04);
        fPos[idx + 2] = Math.sin(vortexAngle) * vortexR + curl.z * (0.35 + state.audioIntensity * 0.6);

        const baseTint = fluidBaseTints[i];
        fCol[idx] = baseTint * state.currentColorA.r * (0.8 + state.audioIntensity * 0.35);
        fCol[idx + 1] = baseTint * state.currentColorA.g * (0.8 + state.audioIntensity * 0.35);
        fCol[idx + 2] = baseTint * state.currentColorA.b * (0.8 + state.audioIntensity * 0.35);

        if (fPos[idx + 1] < -34) {
          fPos[idx + 1] = 34;
          const newR = Math.pow(Math.random(), 0.5) * 36;
          const newAngle = Math.random() * Math.PI * 2;
          fPos[idx] = Math.cos(newAngle) * newR;
          fPos[idx + 2] = Math.sin(newAngle) * newR;
        }
      }
      fluidPosAttr.needsUpdate = true;
      fluidColAttr.needsUpdate = true;

      const dustPosAttr = dustGeo.attributes.position;
      const dPos = dustPosAttr.array;
      for (let i = 0; i < DUST_COUNT; i++) {
        const idx = i * 3;
        const phase = dustPhase[i];
        dPos[idx] += Math.sin(time * 0.2 + phase) * 0.012;
        dPos[idx + 1] += Math.cos(time * 0.18 + phase) * 0.018;
        dPos[idx + 2] += Math.sin(time * 0.12 + phase * 2) * 0.012;
        if (dPos[idx + 1] > 45) dPos[idx + 1] = -45;
        if (dPos[idx + 1] < -45) dPos[idx + 1] = 45;
      }
      dustPosAttr.needsUpdate = true;

      camera.position.x = Math.sin(time * 0.04) * 2 + mouse.x * 3.5;
      camera.position.y = Math.cos(time * 0.03) * 1.8 + mouse.y * 2.8;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      render2DWaveform();
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // View mode switch buttons
    const modeButtons = [
      { id: 'view-mode-combined', mode: 'combined' },
      { id: 'view-mode-freq', mode: 'freq' },
      { id: 'view-mode-dna', mode: 'dna' }
    ];

    modeButtons.forEach(btnObj => {
      const btn = document.getElementById(btnObj.id);
      if (btn) {
        btn.addEventListener('click', () => {
          modeButtons.forEach(b => {
            const el = document.getElementById(b.id);
            if(el) el.className = 'px-2.5 py-1 rounded text-zinc-400 hover:text-white transition-all';
          });
          btn.className = 'px-2.5 py-1 rounded bg-white/10 text-white font-medium transition-all shadow-[0_0_8px_rgba(255,255,255,0.15)]';
          state.viewMode = btnObj.mode;
          document.getElementById('hud-envelope').textContent = btnObj.mode === 'combined' ? 'HARMONIC VORTEX' : btnObj.mode === 'freq' ? 'FFT SPECTRAL' : 'HELIX LATTICE';
        });
      }
    });

    // Background 3D Simulation toggle mode
    const toggleHelixBtn = document.getElementById('toggle-helix-btn');
    const helixModeLabel = document.getElementById('helix-mode-label');
    const simModes = ['Helix + Vortex', 'Fluid Torrent', 'Dark Dust Void'];

    toggleHelixBtn.addEventListener('click', () => {
      state.simulationMode = (state.simulationMode + 1) % 3;
      helixModeLabel.textContent = simModes[state.simulationMode];

      if (state.simulationMode === 0) {
        helixMesh.visible = true; bridgeMesh.visible = true; fluidMesh.visible = true; dustMesh.visible = true;
      } else if (state.simulationMode === 1) {
        helixMesh.visible = false; bridgeMesh.visible = false; fluidMesh.visible = true; dustMesh.visible = true;
      } else {
        helixMesh.visible = false; bridgeMesh.visible = false; fluidMesh.visible = false; dustMesh.visible = true;
      }
      showToast(`Simulation switched to ${simModes[state.simulationMode]}`);
    });

    let toastTimeout = null;
    function showToast(msg) {
      const toast = document.getElementById('toast-alert');
      const text = document.getElementById('toast-message');
      text.textContent = msg;
      toast.classList.remove('opacity-0', 'translate-y-24', 'pointer-events-none');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-24', 'pointer-events-none');
      }, 3000);
    }

    window.onload = function() {
      renderVoiceCards();
      renderTimeline();
      applyArchetypeColors(voiceProfiles[state.selectedVoice]);
      animate();
      showToast('Local studio ready. H for Zen View.');
    };
  