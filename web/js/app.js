// app.js - Final version - Main entry point for Tesserack
import { Emulator } from './emulator.js';
import { MemoryReader } from './memory-reader.js';
import { initLLM, isReady } from './llm.js';
import { GameAgent } from './agent.js';
import { saveState, loadState, hasSavedState } from './storage.js';

console.log('Tesserack loading...');

// DOM elements
const romDrop = document.getElementById('rom-drop');
const romInput = document.getElementById('rom-input');
const gameCanvas = document.getElementById('game-canvas');
const statusText = document.getElementById('status-text');
const turboBtn = document.getElementById('turbo-btn');
const llmBtn = document.getElementById('llm-btn');
const stopBtn = document.getElementById('stop-btn');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const gameStateDiv = document.getElementById('game-state');

// Manual control buttons
const manualButtons = document.querySelectorAll('[data-btn]');
const turboABtn = document.getElementById('turbo-a-btn');

// Hint input
const hintInput = document.getElementById('hint-input');
const hintBtn = document.getElementById('hint-btn');
const hintStatus = document.getElementById('hint-status');
const objectiveDiv = document.getElementById('objective');

// State
let emulator = null;
let turboAInterval = null;
let llmInitialized = false;
let agent = null;
let memoryReader = null;

// Initialize AI model
async function initializeAI() {
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    progressContainer.style.display = 'flex';
    statusText.textContent = 'Loading AI model...';

    try {
        await initLLM((progress) => {
            const pct = Math.round(progress.progress * 100);
            progressBar.style.setProperty('--progress', `${pct}%`);
            progressText.textContent = `${pct}%`;
            statusText.textContent = progress.text || 'Loading AI model...';
        });

        progressContainer.style.display = 'none';
        statusText.textContent = 'Ready! Click Turbo or LLM to start.';
        llmBtn.disabled = false;
        llmInitialized = true;
    } catch (err) {
        progressContainer.style.display = 'none';
        statusText.textContent = `AI Error: ${err.message}`;
        console.error('AI initialization error:', err);
    }
}

// Agent update handler
function handleAgentUpdate(update) {
    // Update UI
    document.getElementById('game-state').innerHTML = formatState(update.state);
    document.getElementById('reasoning').textContent = update.reasoning;
    document.getElementById('actions').textContent = update.action.join(', ');

    // Update objective display
    if (update.objective) {
        objectiveDiv.innerHTML = `<strong>Objective:</strong> ${update.objective}`;
    }

    // Update hint status
    if (update.userHint) {
        hintStatus.textContent = `Following hint (${update.hintRemaining} calls remaining): "${update.userHint}"`;
        hintStatus.classList.add('active');
    } else {
        hintStatus.textContent = '';
        hintStatus.classList.remove('active');
    }
}

// Format game state for display
function formatState(state) {
    return `
        <div><strong>Location:</strong> ${state.location}</div>
        <div><strong>Position:</strong> (${state.coordinates.x}, ${state.coordinates.y})</div>
        <div><strong>Money:</strong> $${state.money}</div>
        <div><strong>Badges:</strong> ${state.badges.join(', ') || 'None'}</div>
        <div><strong>Party:</strong></div>
        ${state.party.map(p => `<div style="margin-left:10px">${p.species} Lv.${p.level} HP:${p.currentHP}/${p.maxHP}</div>`).join('')}
    `;
}

// ROM drop handling
romDrop.addEventListener('click', () => romInput.click());
romDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    romDrop.classList.add('dragover');
});
romDrop.addEventListener('dragleave', () => {
    romDrop.classList.remove('dragover');
});
romDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    romDrop.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadROM(file);
});
romInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadROM(file);
});

async function loadROM(file) {
    statusText.textContent = `Loading ${file.name}...`;

    try {
        const buffer = await file.arrayBuffer();
        console.log('ROM loaded:', buffer.byteLength, 'bytes');

        // Create and initialize emulator
        emulator = new Emulator(gameCanvas);
        await emulator.loadROM(buffer);

        // Hide drop zone, show canvas
        romDrop.style.display = 'none';
        gameCanvas.style.display = 'block';

        // Enable buttons (except LLM which requires AI to be loaded)
        turboBtn.disabled = false;
        llmBtn.disabled = true; // Will be enabled after LLM loads
        saveBtn.disabled = false;
        loadBtn.disabled = !hasSavedState();
        stopBtn.disabled = false;
        hintInput.disabled = false;
        hintBtn.disabled = false;

        // Set up frame callback to update game state display
        emulator.frameCallback = updateGameStateDisplay;

        // Initialize memory reader and agent
        memoryReader = new MemoryReader(emulator);
        agent = new GameAgent(emulator, memoryReader, handleAgentUpdate);

        // Start emulator display loop
        emulator.start();

        statusText.textContent = 'ROM loaded! Loading AI model...';
        updateGameStateDisplay();

        // Initialize AI after ROM loads
        initializeAI();
    } catch (err) {
        statusText.textContent = `Error: ${err.message}`;
        console.error('Failed to load ROM:', err);
    }
}

// Update game state display (basic info for now)
function updateGameStateDisplay() {
    if (!emulator) {
        gameStateDiv.textContent = 'Waiting for ROM...';
        return;
    }

    // Read some basic Pokemon Red memory locations
    // These are well-known addresses for Pokemon Red
    try {
        const regs = emulator.getRegisters();

        // Pokemon Red specific addresses (example)
        // 0xD163 = Player X position in map
        // 0xD164 = Player Y position in map
        // 0xD35E = Current map ID
        const playerX = emulator.readMemory(0xD362);
        const playerY = emulator.readMemory(0xD361);
        const mapId = emulator.readMemory(0xD35E);

        gameStateDiv.innerHTML = `
            <div>PC: 0x${regs.PC.toString(16).toUpperCase().padStart(4, '0')}</div>
            <div>Map: ${mapId} | Pos: (${playerX}, ${playerY})</div>
        `;
    } catch (e) {
        gameStateDiv.textContent = 'Emulator running...';
    }
}

// Button handlers
turboBtn.addEventListener('click', () => {
    if (agent) {
        agent.runTurbo();
        turboBtn.disabled = true;
        llmBtn.disabled = true;
        stopBtn.disabled = false;
        statusText.textContent = 'Turbo mode running...';
    }
});

llmBtn.addEventListener('click', () => {
    if (agent) {
        agent.runLLM();
        turboBtn.disabled = true;
        llmBtn.disabled = true;
        stopBtn.disabled = false;
        statusText.textContent = 'LLM mode running...';
    }
});

stopBtn.addEventListener('click', () => {
    if (agent) {
        agent.stop();
    }
    turboBtn.disabled = false;
    llmBtn.disabled = !llmInitialized;
    stopBtn.disabled = true;
    statusText.textContent = 'Stopped';
    // Stop turbo A if running
    if (turboAInterval) {
        clearInterval(turboAInterval);
        turboAInterval = null;
    }
});

saveBtn.addEventListener('click', () => {
    if (emulator) {
        if (saveState(emulator)) {
            statusText.textContent = 'Game saved!';
            loadBtn.disabled = false;
        } else {
            statusText.textContent = 'Save failed!';
        }
    }
});

loadBtn.addEventListener('click', () => {
    if (emulator) {
        if (loadState(emulator)) {
            statusText.textContent = 'Game loaded!';
        } else {
            statusText.textContent = 'Load failed!';
        }
    }
});

// Manual controls handling
manualButtons.forEach(btn => {
    const buttonName = btn.dataset.btn;

    // Mouse events - use agent.manualButton for press, direct emulator for hold/release
    btn.addEventListener('mousedown', () => {
        if (agent && agent.running) {
            agent.manualButton(buttonName);
        } else if (emulator) {
            emulator.setButton(buttonName, true);
        }
    });
    btn.addEventListener('mouseup', () => {
        if (emulator && !agent?.running) emulator.setButton(buttonName, false);
    });
    btn.addEventListener('mouseleave', () => {
        if (emulator && !agent?.running) emulator.setButton(buttonName, false);
    });

    // Touch events for mobile
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (agent && agent.running) {
            agent.manualButton(buttonName);
        } else if (emulator) {
            emulator.setButton(buttonName, true);
        }
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (emulator && !agent?.running) emulator.setButton(buttonName, false);
    });
});

// Turbo A button (hold)
turboABtn.addEventListener('mousedown', () => {
    turboAInterval = setInterval(() => {
        if (agent) agent.manualButton('a');
    }, 100);
});

turboABtn.addEventListener('mouseup', () => {
    if (turboAInterval) {
        clearInterval(turboAInterval);
        turboAInterval = null;
    }
});

turboABtn.addEventListener('mouseleave', () => {
    if (turboAInterval) {
        clearInterval(turboAInterval);
        turboAInterval = null;
    }
});

// Keyboard controls
const keyMap = {
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'z': 'a',
    'x': 'b',
    'Enter': 'start',
    'Shift': 'select'
};

document.addEventListener('keydown', (e) => {
    const button = keyMap[e.key];
    if (button && agent) {
        agent.manualButton(button);
        e.preventDefault();
    }
});

// Hint input handling
function sendHint() {
    const hint = hintInput.value.trim();
    if (hint && agent) {
        agent.setUserHint(hint);
        hintStatus.textContent = `Hint sent: "${hint}"`;
        hintStatus.classList.add('active');
        hintInput.value = '';
        statusText.textContent = 'Hint received! Agent will follow your guidance.';
    }
}

hintBtn.addEventListener('click', sendHint);
hintInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendHint();
    }
});

console.log('Tesserack ready');
