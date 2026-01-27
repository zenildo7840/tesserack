# Tesserack

Experimental reinforcement learning infrastructure for studying hierarchical task decomposition in game environments.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://sidmohan0.github.io/tesserack/)

> **Lab Mode (Experimental)**
> This repository contains experimental reinforcement learning infrastructure for studying credit assignment via deterministic reward specifications. Results are exploratory and configurations may change.

## Overview

Tesserack is a research test bed for studying reinforcement learning in game environments. It supports two execution modes:

- **Hierarchical mode**: Language model handles task decomposition, policy network executes
- **Pure RL mode**: Policy network acts directly, rewards from deterministic unit tests

The environment is Pokemon Red, chosen for its deterministic mechanics and well-documented memory layout.

**Two interfaces:**

| | Browser | Lab |
|---|---------|-----|
| **Purpose** | Interactive demo | Research experiments |
| **Setup** | Zero (just open it) | Python environment |
| **Models** | WebLLM (1-3B) or API | Any (local or API) |
| **Speed** | Real-time | 10x+ (headless) |
| **Location** | `app/` | `lab/` |

## Browser Version

Zero-setup demo running entirely client-side via WebGPU.

```bash
cd app
npm install
npm run dev
```

**Requirements:** Chrome/Edge 113+ (WebGPU), Pokemon Red ROM

**Features:**
- **LLM Mode**: Language model via WebLLM or external APIs (OpenAI, Groq, local)
- **Pure RL Mode**: No LLM calls - simple policy network with epsilon-greedy exploration and deterministic unit-test rewards (toggle via "Pure RL" button in Lab)
- Policy network training visualization
- Game state inspection
- Real-time reward breakdown (tier1/tier2/tier3/penalties)

## Lab (Experimental)

For running experiments, comparing configurations, and exploring training dynamics.

```bash
cd lab
pip install -r requirements.txt

# Hierarchical mode (LLM + Policy)
python scripts/run_experiment.py --rom pokemon_red.gb

# Pure RL mode (no LLM, unit test rewards)
python scripts/run_experiment.py configs/pure_rl_unit_tests.json
```

**Requirements:** Python 3.10+, Pokemon Red ROM. Ollama only needed for hierarchical mode.

**Features:**
- Two execution modes: hierarchical (LLM+Policy) and pure RL
- Deterministic unit-test-style rewards with tiered breakdown
- Headless execution at 10x+ speed
- Experiment logging and metrics

See [lab/README.md](lab/README.md) for details.

## Architecture

### Hierarchical Mode (LLM + Policy)

```
┌─────────────────────────────────────────────────────────────┐
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

### Pure RL Mode (Unit Test Rewards)

```
┌─────────────────────────────────────────────────────────────┐
│   ┌─────────────┐         ┌─────────────┐                   │
│   │   Policy    │ action  │  Emulator   │  new state        │
│   │   πθ(a|s)   │────────▶│   (PyBoy)   │─────────┐         │
│   └─────────────┘         └─────────────┘         │         │
│         ▲                                         │         │
│         │ learns                                  ▼         │
│   ┌─────────────┐         ┌─────────────────────────────┐   │
│   │ Experience  │◀────────│  Unit Test Rewarder         │   │
│   │   Buffer    │  reward │  tests(prev,curr) → r       │   │
│   └─────────────┘         └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Hierarchical mode**: LLM issues task-level goals, policy executes, learns from shaping rewards

**Pure RL mode**: Policy acts directly every step, deterministic unit tests compute rewards

## Current Focus

Exploring whether hierarchical task decomposition enables small models (3B parameters) to make meaningful progress through early-game milestones.

**Milestones under study:**
- [ ] Brock (Boulder Badge)
- [ ] Misty (Cascade Badge)

## Links

- [Live Demo](https://sidmohan0.github.io/tesserack/)
- [Design Doc](docs/plans/2026-01-26-test-bed-harness-design.md)

## License

MIT

---

Built by [Sid Mohan](https://github.com/sidmohan0)
