"""LLM interface for strategic planning."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import json

from .state import GameState
from .tasks import Task


@dataclass
class LLMConfig:
    model: str = "llama3.2:3b"
    temperature: float = 0.7
    max_tokens: int = 256
    base_url: str = "http://localhost:11434"  # Ollama default


@dataclass
class TaskHistory:
    task: Task
    success: bool
    steps: int
    failure_reason: str = ""


class LLMBackend(ABC):
    """Abstract base class for LLM backends."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Generate response from prompt."""
        pass


class OllamaBackend(LLMBackend):
    """Ollama backend for local LLMs."""

    def __init__(self, config: LLMConfig):
        self.config = config
        try:
            import httpx
            self.client = httpx.Client(timeout=60.0)
        except ImportError:
            raise ImportError("httpx not installed. Run: pip install httpx")

    def generate(self, prompt: str) -> str:
        response = self.client.post(
            f"{self.config.base_url}/api/generate",
            json={
                "model": self.config.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": self.config.temperature,
                    "num_predict": self.config.max_tokens,
                },
            },
        )
        response.raise_for_status()
        return response.json()["response"]


class OpenAIBackend(LLMBackend):
    """OpenAI-compatible API backend (works with OpenAI, Groq, Together, etc.)."""

    def __init__(self, config: LLMConfig, api_key: str):
        self.config = config
        self.api_key = api_key
        try:
            import httpx
            self.client = httpx.Client(timeout=60.0)
        except ImportError:
            raise ImportError("httpx not installed. Run: pip install httpx")

    def generate(self, prompt: str) -> str:
        response = self.client.post(
            f"{self.config.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.config.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": self.config.temperature,
                "max_tokens": self.config.max_tokens,
            },
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


SYSTEM_PROMPT = """You are playing Pokemon Red. Your goal is to complete the game efficiently.

You will receive the current game state and must issue ONE task at a time.

Available task types:
- navigate: Go to a location (e.g., "navigate | Pewter City")
- catch: Catch a Pokemon (e.g., "catch | Pikachu")
- train: Train party to a level (e.g., "train | level 14")
- battle: Fight a trainer/gym (e.g., "battle | Brock")
- buy: Purchase items (e.g., "buy | 5 Potions")
- use_item: Use an item (e.g., "use_item | Potion on Pikachu")

Respond with ONLY the task in this format:
TASK: type | target | brief reason

Example:
TASK: navigate | Viridian Forest | Need to catch Pikachu for Brock fight"""


class Planner:
    """LLM-based strategic planner."""

    def __init__(
        self,
        backend: LLMBackend,
        strategy_guide: Optional[dict] = None,
    ):
        self.backend = backend
        self.strategy_guide = strategy_guide or {}
        self.task_history: list[TaskHistory] = []

    def get_next_task(
        self,
        state: GameState,
        objective: str,
        failure_context: Optional[str] = None,
    ) -> str:
        """Query LLM for next task."""
        prompt = self._build_prompt(state, objective, failure_context)
        return self.backend.generate(prompt)

    def record_task_result(
        self,
        task: Task,
        success: bool,
        steps: int,
        failure_reason: str = "",
    ):
        """Record task outcome for history."""
        self.task_history.append(
            TaskHistory(
                task=task,
                success=success,
                steps=steps,
                failure_reason=failure_reason,
            )
        )
        # Keep last 10 tasks
        if len(self.task_history) > 10:
            self.task_history = self.task_history[-10:]

    def _build_prompt(
        self,
        state: GameState,
        objective: str,
        failure_context: Optional[str] = None,
    ) -> str:
        """Build prompt with game state and context."""
        parts = [SYSTEM_PROMPT, ""]

        # Current objective
        parts.append(f"CURRENT OBJECTIVE: {objective}")
        parts.append("")

        # Game state
        parts.append("GAME STATE:")
        parts.append(f"- Location: Map {state.map_id} ({state.player_x}, {state.player_y})")
        parts.append(f"- Party: {state.party_summary()}")
        parts.append(f"- Badges: {state.badge_count}/8")
        parts.append(f"- Money: ${state.money}")
        if state.in_battle:
            parts.append(f"- IN BATTLE (Enemy HP: {state.enemy_hp})")
        parts.append("")

        # Recent task history
        if self.task_history:
            parts.append("RECENT TASKS:")
            for h in self.task_history[-5:]:
                status = "OK" if h.success else "FAILED"
                parts.append(f"- {h.task.to_prompt()} [{status}, {h.steps} steps]")
                if h.failure_reason:
                    parts.append(f"  Reason: {h.failure_reason}")
            parts.append("")

        # Failure context (if re-planning)
        if failure_context:
            parts.append(f"FAILURE CONTEXT: {failure_context}")
            parts.append("")

        # Strategy hint (if available)
        hint = self._get_strategy_hint(state, objective)
        if hint:
            parts.append(f"STRATEGY HINT: {hint}")
            parts.append("")

        parts.append("What is the next task?")

        return "\n".join(parts)

    def _get_strategy_hint(self, state: GameState, objective: str) -> str:
        """Get relevant hint from strategy guide."""
        # TODO: Implement strategy guide lookup
        return ""
