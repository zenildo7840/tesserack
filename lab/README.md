# Tesserack Lab

Python test bed for training LLMs to play Pokemon Red.

## Overview

This is the experimentation layer of Tesserack. It provides:

- **Hierarchical learning**: LLM for strategic planning, policy network for tactical execution
- **Task-based abstraction**: LLM issues high-level tasks, harness handles completion detection
- **Full experiment tracking**: Every task, checkpoint, and training step is logged
- **Configurable everything**: Swap LLMs, tweak policy networks, adjust rewards

## Quick Start

### 1. Install dependencies

```bash
cd lab
pip install -r requirements.txt
```

### 2. Get a Pokemon Red ROM

Place `pokemon_red.gb` in the `lab` directory (or specify path with `--rom`).

### 3. Start Ollama (or other LLM backend)

```bash
# Using Ollama
ollama pull llama3.2:3b
ollama serve
```

### 4. Run an experiment

```bash
# Using default config
python scripts/run_experiment.py --rom pokemon_red.gb

# With custom config
python scripts/run_experiment.py configs/default.json

# With visualization
python scripts/run_experiment.py --show
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        HARNESS                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │    LLM      │    │   Policy    │    │    Emulator     │  │
│  │  (Planner)  │───▶│  (Executor) │───▶│    (PyBoy)      │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                  ▲                    │            │
│         │                  │                    │            │
│         ▼                  │                    ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │    Task     │    │  Experience │    │   Game State    │  │
│  │   System    │    │   Buffer    │    │    Reader       │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### The Loop

1. **LLM Planning**: Given game state + objective, LLM issues a task
2. **Policy Execution**: Policy network takes actions to complete task
3. **Completion Detection**: Memory triggers detect when task succeeds
4. **Experience Collection**: State/action/reward tuples stored for training
5. **Periodic Training**: Policy network learns from collected experiences

## Configuration

See `configs/default.json` for all options. Key settings:

```json
{
  "llm": {
    "backend": "ollama",        // or "openai"
    "model": "llama3.2:3b"
  },
  "policy": {
    "epsilon_start": 0.3,       // Initial exploration
    "train_every": 100          // Training frequency
  },
  "task": {
    "default_budget": 1000      // Max steps per task
  }
}
```

## Experiment Outputs

Each run creates in `runs/`:

- `{run_id}_config.json` - Experiment configuration
- `{run_id}_tasks.jsonl` - Task-by-task log
- `{run_id}_checkpoints.jsonl` - Checkpoint progression
- `{run_id}_summary.json` - Final metrics
- `{run_id}_policy.npz` - Trained policy weights
- `{run_id}_cp{N}.state` - Emulator save states

## MVP Goal

Get a small LLM (Llama 3.2 3B or similar) to beat the first 2 gyms:

- [ ] Brock (Boulder Badge)
- [ ] Misty (Cascade Badge)

## Development

```
lab/
├── tesserack/
│   ├── emulator.py    # PyBoy wrapper
│   ├── state.py       # Game state extraction
│   ├── tasks.py       # Task definitions
│   ├── llm.py         # LLM interface
│   ├── policy.py      # Policy network
│   ├── harness.py     # Main loop
│   ├── metrics.py     # Logging
│   └── config.py      # Configuration
├── configs/           # Experiment configs
├── scripts/           # Entry points
└── runs/              # Experiment outputs
```
