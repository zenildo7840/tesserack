"""PyBoy emulator wrapper for Pokemon Red."""

from pathlib import Path
from typing import Optional
import numpy as np

try:
    from pyboy import PyBoy
except ImportError:
    raise ImportError("PyBoy not installed. Run: pip install pyboy")


class Emulator:
    """Wrapper around PyBoy for Pokemon Red."""

    def __init__(
        self,
        rom_path: str | Path,
        headless: bool = True,
        speed: int = 0,  # 0 = uncapped
    ):
        self.rom_path = Path(rom_path)
        if not self.rom_path.exists():
            raise FileNotFoundError(f"ROM not found: {self.rom_path}")

        window_type = "null" if headless else "SDL2"
        self.pyboy = PyBoy(
            str(self.rom_path),
            window=window_type,
        )
        self.pyboy.set_emulation_speed(speed)

    def step(self, frames: int = 1) -> None:
        """Advance emulator by N frames."""
        for _ in range(frames):
            self.pyboy.tick()

    def press(self, button: str, hold_frames: int = 8, release_frames: int = 4) -> None:
        """Press a button and release it."""
        valid_buttons = {"a", "b", "start", "select", "up", "down", "left", "right"}
        button = button.lower()
        if button not in valid_buttons:
            raise ValueError(f"Invalid button: {button}. Valid: {valid_buttons}")

        self.pyboy.button(button)
        self.step(hold_frames)
        self.pyboy.button_release(button)
        self.step(release_frames)

    def read_memory(self, address: int) -> int:
        """Read a single byte from memory."""
        return self.pyboy.memory[address]

    def read_memory_range(self, start: int, length: int) -> bytes:
        """Read a range of bytes from memory."""
        return bytes(self.pyboy.memory[start : start + length])

    def save_state(self, path: str | Path) -> None:
        """Save emulator state to file."""
        path = Path(path)
        with open(path, "wb") as f:
            self.pyboy.save_state(f)

    def load_state(self, path: str | Path) -> None:
        """Load emulator state from file."""
        path = Path(path)
        with open(path, "rb") as f:
            self.pyboy.load_state(f)

    def screenshot(self) -> np.ndarray:
        """Get current screen as numpy array."""
        return np.array(self.pyboy.screen)

    def close(self) -> None:
        """Clean up emulator."""
        self.pyboy.stop()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
