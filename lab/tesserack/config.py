"""Experiment configuration."""

from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional
import json


@dataclass
class EmulatorConfig:
    rom_path: str = "pokemon_red.gb"
    headless: bool = True
    speed: int = 0  # 0 = uncapped
    save_state_path: Optional[str] = None  # Start from save state


@dataclass
class LLMConfig:
    backend: str = "ollama"  # "ollama" | "openai"
    model: str = "llama3.2:3b"
    base_url: str = "http://localhost:11434"
    api_key: str = ""  # For OpenAI-compatible APIs
    temperature: float = 0.7
    max_tokens: int = 256


@dataclass
class PolicyConfig:
    state_dim: int = 64
    task_dim: int = 32
    hidden_dim: int = 128
    learning_rate: float = 1e-3
    epsilon_start: float = 0.3
    epsilon_end: float = 0.05
    epsilon_decay: float = 0.995
    train_every: int = 100  # Train every N steps
    batch_size: int = 32
    load_weights: Optional[str] = None  # Path to pre-trained weights


@dataclass
class TaskConfig:
    default_budget: int = 1000  # Max steps per task
    replan_on_failure: bool = True
    max_replans: int = 3


@dataclass
class ExperimentConfig:
    name: str = "default"
    description: str = ""

    # Target checkpoint (0 = as far as possible)
    target_checkpoint: int = 0
    max_steps: int = 100000

    # Component configs
    emulator: EmulatorConfig = field(default_factory=EmulatorConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    policy: PolicyConfig = field(default_factory=PolicyConfig)
    task: TaskConfig = field(default_factory=TaskConfig)

    # Output
    runs_dir: str = "runs"
    save_checkpoints: bool = True
    checkpoint_interval: int = 1  # Save state every N checkpoints

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "ExperimentConfig":
        """Create from dictionary."""
        return cls(
            name=data.get("name", "default"),
            description=data.get("description", ""),
            target_checkpoint=data.get("target_checkpoint", 0),
            max_steps=data.get("max_steps", 100000),
            emulator=EmulatorConfig(**data.get("emulator", {})),
            llm=LLMConfig(**data.get("llm", {})),
            policy=PolicyConfig(**data.get("policy", {})),
            task=TaskConfig(**data.get("task", {})),
            runs_dir=data.get("runs_dir", "runs"),
            save_checkpoints=data.get("save_checkpoints", True),
            checkpoint_interval=data.get("checkpoint_interval", 1),
        )

    @classmethod
    def from_file(cls, path: str | Path) -> "ExperimentConfig":
        """Load config from JSON file."""
        with open(path) as f:
            data = json.load(f)
        return cls.from_dict(data)

    def save(self, path: str | Path):
        """Save config to JSON file."""
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)


# Default checkpoints from strategy guide (through Misty for MVP)
CHECKPOINTS = [
    {"id": 1, "name": "Get starter Pokemon", "badge_required": 0},
    {"id": 2, "name": "Reach Viridian City", "badge_required": 0},
    {"id": 3, "name": "Deliver Oak's Parcel", "badge_required": 0},
    {"id": 4, "name": "Get Pokedex", "badge_required": 0},
    {"id": 5, "name": "Reach Viridian Forest", "badge_required": 0},
    {"id": 6, "name": "Reach Pewter City", "badge_required": 0},
    {"id": 7, "name": "Defeat Brock (Boulder Badge)", "badge_required": 1},
    {"id": 8, "name": "Reach Mt. Moon", "badge_required": 1},
    {"id": 9, "name": "Complete Mt. Moon", "badge_required": 1},
    {"id": 10, "name": "Reach Cerulean City", "badge_required": 1},
    {"id": 11, "name": "Defeat Rival on Nugget Bridge", "badge_required": 1},
    {"id": 12, "name": "Get HM01 Cut", "badge_required": 1},
    {"id": 13, "name": "Defeat Misty (Cascade Badge)", "badge_required": 2},
    # ... more checkpoints for full game
]
