# Tesserack

Browser-based AI that learns to play Pokemon Red. No server required.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://sidmohan0.github.io/tesserack/)

## Overview

Tesserack combines an LLM (Qwen2.5-1.5B via WebGPU), a trainable policy network (TensorFlow.js), and a GameBoy emulator (binjgb/WASM) to play Pokemon Red entirely client-side.

Objectives are sourced from Prima's Official Strategy Guide (1999) — 47 ordered checkpoints from Pallet Town to the Hall of Fame.

## Requirements

- Chrome/Edge 113+ (WebGPU)
- Pokemon Red ROM (.gb)

## Quick Start

```bash
git clone https://github.com/sidmohan0/tesserack.git
cd tesserack/svelte-app
npm install
npm run dev
```

## Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM | WebLLM (Qwen2.5-1.5B) | Action planning |
| Policy Network | TensorFlow.js | Learned action selection |
| Emulator | binjgb (WASM) | Game execution |
| State | Direct RAM reading | Ground-truth game state |
| Curriculum | Prima Guide (1999) | Structured objectives |

## Storage

All data persists locally: experiences and model weights in IndexedDB, game saves in localStorage, LLM weights in browser cache (~1.5GB).

## Links

- [Live Demo](https://sidmohan0.github.io/tesserack/)
- [DataFog](https://datafog.ai)
- [Threadfork](https://threadfork.com)

## License

MIT

---

Built by [Sid Mohan](https://github.com/sidmohan0)
