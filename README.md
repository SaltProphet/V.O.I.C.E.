# Voice Studio

A personal, locally hosted voice workspace for Windows: recording, voice references, Qwen3-TTS voice cloning, non-destructive cleanup, a basic multitrack timeline, and WAV export. Includes the AuraVoice immersive interface, local dialogue sequencing, and generated demo audio.

The application is under [`voice-studio/`](voice-studio/). See its [user guide](voice-studio/README.md) and [private demo sharing guide](voice-studio/SHARING.md).

## Current interface

The default **Immersive studio** view uses the supplied AuraVoice design: a reactive 3D helix, particles, voice palettes, dialogue sequence blocks, local voice references, playback, and WAV downloads. **Recorder & editor** retains recording, waveform editing, cleanup, and multitrack tools. **Classic view** retains the simplified interface.

See [AuraVoice integration and verification](voice-studio/AURAVOICE.md) for behavior and known limits.

## Windows setup

Prerequisites: Python 3.12, Git, Node.js/npm, FFmpeg on PATH, and an NVIDIA GPU with a compatible driver. Tested on an RTX A4500 with CUDA-enabled PyTorch 2.8.0. Model downloads require several GB of disk space and internet access; inference runs locally.

From the repository directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\voice-studio\Setup-Voice-Studio.ps1
.\voice-studio\Launch-Voice-Studio.cmd
```

Open **http://127.0.0.1:8765**. Setup creates an isolated Python environment, checks out the pinned official Qwen3-TTS source, installs dependencies, downloads Base/tokenizer weights, builds the frontend, and installs the packaged welcome/demo audio. It does not change existing AI application settings.

All new servers bind to localhost. Remote sharing is optional and requires an explicit individual-email allowlist; see the sharing guide. GPU inference, recordings, profiles, sessions, and exports stay on the host PC. A shared tunnel transports guest audio through Cloudflare.

## Repository contents

Included: frontend/backend/inference source, Windows launchers, dependency locks, setup and verification scripts, final synthetic narrator reference, generated walkthrough, and generated demo clips.

Excluded: personal recordings and profiles, sessions, exports, local logs, email allowlists, active sharing URLs, credentials, Python/Node environments, downloaded model weights, vendor checkout, and machine-specific installation reports. Those are local files; this repository is not a backup of your personal audio library.

Voice Studio uses the official [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) package. Review upstream model and dependency licenses for your intended use. The bundled host is a synthetic adult female voice. The small original test reference is fetched from the official README URL during sample installation rather than redistributed here.
