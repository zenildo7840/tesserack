"""FastAPI web server with WebSocket for live updates."""

import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from agent import Emulator, GameAgent
from llm import LlamaCppBackend
import config


app = FastAPI(title="LocalLLMPlaysPokemon")

# Global state
agent: GameAgent | None = None
connected_clients: list[WebSocket] = []


async def broadcast(data: dict):
    """Send update to all connected WebSocket clients."""
    message = json.dumps(data, default=str)
    disconnected = []
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.append(client)
    for client in disconnected:
        connected_clients.remove(client)


@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the main page."""
    html_path = Path(__file__).parent / "static" / "index.html"
    if html_path.exists():
        return html_path.read_text()
    return """
    <!DOCTYPE html>
    <html>
    <head><title>LocalLLMPlaysPokemon</title></head>
    <body>
        <h1>LocalLLMPlaysPokemon</h1>
        <p>Static files not found. Run from project root.</p>
    </body>
    </html>
    """


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for live updates."""
    await websocket.accept()
    connected_clients.append(websocket)

    try:
        while True:
            # Keep connection alive, handle any incoming messages
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "start":
                await start_agent(msg.get("rom_path", config.ROM_PATH))
            elif msg.get("type") == "stop":
                stop_agent()
            elif msg.get("type") == "step":
                if agent:
                    await agent.step()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


async def start_agent(rom_path: str):
    """Initialize and start the agent."""
    global agent

    if agent is not None:
        return

    # Initialize LLM
    llm = LlamaCppBackend(
        model_path=config.MODEL_PATH,
        n_ctx=config.CONTEXT_SIZE,
        n_gpu_layers=config.N_GPU_LAYERS,
    )

    # Initialize emulator
    emulator = Emulator(rom_path, headless=True)
    emulator.initialize()

    # Create agent
    agent = GameAgent(llm, emulator, max_history=config.MAX_HISTORY_TURNS)
    agent.add_callback(broadcast)

    # Start running in background
    asyncio.create_task(agent.run(delay=1.0))

    await broadcast({"type": "started", "message": "Agent started"})


def stop_agent():
    """Stop the running agent."""
    global agent
    if agent:
        agent.stop()
        agent.emulator.stop()
        agent = None


# Mount static files
static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")
