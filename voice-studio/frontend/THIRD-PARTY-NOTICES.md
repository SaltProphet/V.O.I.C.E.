# Bundled frontend dependencies

The immersive stage reuses the user-supplied HTML's layout and animation code. The original source is preserved at `src/immersive/reference.html`; browser code is adapted in `AuraStudio.jsx` and connected to real audio by `src/immersive/bridge.js`.

Three.js (MIT), Lucide (ISC), Plus Jakarta Sans (SIL Open Font License), and JetBrains Mono (SIL Open Font License) are bundled locally. Their notices are included under `public/licenses/` and copied into production output. Tailwind CSS compiles the supplied utility classes locally; no runtime CDN is used. React and WaveSurfer remain the existing app dependencies.

Python effects use librosa for duration-preserving pitch shifting and Pedalboard for tone shaping and modulated-delay vibrato. Effects render derivative WAVs; original recordings are preserved.
