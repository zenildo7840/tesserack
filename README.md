# Tesserack

AI Plays Pokemon.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://sidmohan0.github.io/tesserack/)

## Overview

Tesserack is a test bed for training small LLMs to play Pokemon Red. It uses a hierarchical approach: an LLM handles strategic planning while a policy network learns tactical execution.

**Two ways to use Tesserack:**

| | Browser | Lab |
|---|---------|-----|
| **Purpose** | Demo & casual use | Serious experimentation |
| **Setup** | Zero (just open it) | Python environment |
| **LLM** | WebLLM (1-3B) or API | Any (local or API) |
| **Speed** | Real-time | 10x+ (headless) |
| **Location** | `svelte-app/` | `lab/` |

## Browser Version

Zero-setup demo running entirely client-side via WebGPU.

```bash
cd svelte-app
npm install
npm run dev
```

**Requirements:** Chrome/Edge 113+ (WebGPU), Pokemon Red ROM

**Features:**
- LLM via WebLLM or external APIs (OpenAI, Groq, local)
- Live policy network training
- Full game state visibility

## Lab (Python Test Bed)

For running experiments, comparing models, and serious training.

```bash
cd lab
pip install -r requirements.txt
python scripts/run_experiment.py --rom pokemon_red.gb
```

**Requirements:** Python 3.10+, Pokemon Red ROM, Ollama (or other LLM backend)

**Features:**
- Headless execution at 10x+ speed
- Swappable LLM backends
- Full experiment logging and metrics
- Configurable everything

See [lab/README.md](lab/README.md) for details.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HIERARCHICAL LOOP                        │
│                                                              │
│   ┌─────────────┐         ┌─────────────┐                   │
│   │     LLM     │  tasks  │   Policy    │  actions          │
│   │  (Planner)  │────────▶│  (Executor) │─────────▶ Game    │
│   └─────────────┘         └─────────────┘                   │
│         ▲                       │                            │
│         │                       │ learns                     │
│         │   objective          ▼                            │
│   ┌─────────────┐         ┌─────────────┐                   │
│   │  Strategy   │         │ Experience  │                   │
│   │   Guide     │         │   Buffer    │                   │
│   └─────────────┘         └─────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

**LLM Layer:** Issues task-level goals ("Navigate to Pewter City", "Train to level 14")

**Policy Layer:** Executes micro-actions to achieve tasks, learns from experience

**The Harness:** Manages game state, detects task completion, logs everything

## Current Goal

Get a small LLM (3B parameters) to beat the first 2 gyms with the right harness design.

- [ ] Brock (Boulder Badge)
- [ ] Misty (Cascade Badge)

## Links

- [Live Demo](https://sidmohan0.github.io/tesserack/)
- [Design Doc](docs/plans/2026-01-26-test-bed-harness-design.md)

## License

MIT

---

Built by [Sid Mohan](https://github.com/sidmohan0)
