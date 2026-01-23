// app.js - Main entry point for Tesserack
import { Emulator } from './emulator.js';
import { MemoryReader } from './memory-reader.js';
import { initLLM, isReady } from './llm.js';
import { GameAgent } from './agent.js';
import { RLAgent } from './rl-agent.js';
import { DataCollector } from './data-collector.js';
import { saveState, loadState, hasSavedState } from './storage.js';

console.log('Tesserack loading...');

// DOM elements
const romDrop = document.getElementById('rom-drop');
const romInput = document.getElementById('rom-input');
const gameCanvas = document.getElementById('game-canvas');
const statusText = document.getElementById('status-text');
const turboBtn = document.getElementById('turbo-btn');
const llmBtn = document.getElementById('llm-btn');
const rlBtn = document.getElementById('rl-btn');
const stopBtn = document.getElementById('stop-btn');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const gameStateDiv = document.getElementById('game-state');

// RL panel elements
const rlPanel = document.getElementById('rl-panel');
const rlRewardSpan = document.getElementById('rl-reward');
const rlExperiencesSpan = document.getElementById('rl-experiences');
const rlMapsSpan = document.getElementById('rl-maps');
const rlExplorationSpan = document.getElementById('rl-exploration');
const explorationSlider = document.getElementById('exploration-slider');
const exportRlBtn = document.getElementById('export-rl-btn');

// Data collection elements
const exploreBtn = document.getElementById('explore-btn');
const recordBtn = document.getElementById('record-btn');
const stopCollectBtn = document.getElementById('stop-collect-btn');
const exploreCountSpan = document.getElementById('explore-count');
const humanCountSpan = document.getElementById('human-count');
const collectRewardSpan = document.getElementById('collect-reward');
const collectStatus = document.getElementById('collect-status');
const exportTrainingBtn = document.getElementById('export-training-btn');
const clearDataBtn = document.getElementById('clear-data-btn');

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
let rlAgent = null;
let dataCollector = null;
let activeAgent = null;  // Currently running agent
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
        statusText.textContent = 'Ready! Click Turbo, LLM, or RL+LLM to start.';
        llmBtn.disabled = false;
        rlBtn.disabled = false;
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

    // Update RL stats if available
    if (update.rlStats) {
        updateRLStats(update.rlStats);
    }
}

// Update RL statistics display
function updateRLStats(stats) {
    if (rlRewardSpan) {
        rlRewardSpan.textContent = Math.round(stats.reward?.totalReward || 0);
    }
    if (rlExperiencesSpan) {
        rlExperiencesSpan.textContent = stats.buffer?.size || 0;
    }
    if (rlMapsSpan) {
        rlMapsSpan.textContent = stats.reward?.visitedMaps || 0;
    }
    if (rlExplorationSpan) {
        rlExplorationSpan.textContent = `${Math.round((stats.explorationRate || 0.2) * 100)}%`;
    }
}

// Data collector update handler
function handleCollectorUpdate(update) {
    // Update stats display
    if (update.stats) {
        exploreCountSpan.textContent = update.stats.explorationSteps || 0;
        humanCountSpan.textContent = update.stats.humanDemos || 0;
        collectRewardSpan.textContent = Math.round(update.stats.totalReward || 0);
    }

    // Update status
    if (update.mode === 'exploration') {
        collectStatus.textContent = `Exploring... Step ${update.stepCount}`;
        collectStatus.classList.add('active');
    } else if (update.mode === 'recording') {
        if (update.status === 'started') {
            collectStatus.textContent = 'Recording your inputs...';
            collectStatus.classList.add('active');
            recordBtn.classList.add('recording');
            recordBtn.textContent = 'Recording...';
        } else if (update.status === 'stopped') {
            collectStatus.textContent = `Recording stopped. ${update.stats?.humanDemos || 0} demos captured.`;
            recordBtn.classList.remove('recording');
            recordBtn.textContent = 'Record Me';
        } else if (update.action) {
            collectStatus.textContent = `Recorded: ${update.action[0]} (reward: ${update.reward || 0})`;
        }
    }

    // Update game state display
    if (update.state) {
        document.getElementById('game-state').innerHTML = formatState(update.state);
    }

    // Enable export if we have data
    const hasData = (update.stats?.explorationSteps || 0) + (update.stats?.humanDemos || 0) > 0;
    exportTrainingBtn.disabled = !hasData;
    clearDataBtn.disabled = !hasData;
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

        // Initialize memory reader and agents
        memoryReader = new MemoryReader(emulator);
        agent = new GameAgent(emulator, memoryReader, handleAgentUpdate);
        rlAgent = new RLAgent(emulator, memoryReader, handleAgentUpdate);
        dataCollector = new DataCollector(emulator, memoryReader, handleCollectorUpdate);

        // Enable data collection buttons
        exploreBtn.disabled = false;
        recordBtn.disabled = false;
        exportTrainingBtn.disabled = true;
        clearDataBtn.disabled = true;

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
        activeAgent = agent;
        agent.runTurbo();
        turboBtn.disabled = true;
        llmBtn.disabled = true;
        rlBtn.disabled = true;
        stopBtn.disabled = false;
        rlPanel.style.display = 'none';
        statusText.textContent = 'Turbo mode running...';
    }
});

llmBtn.addEventListener('click', () => {
    if (agent) {
        activeAgent = agent;
        agent.runLLM();
        turboBtn.disabled = true;
        llmBtn.disabled = true;
        rlBtn.disabled = true;
        stopBtn.disabled = false;
        rlPanel.style.display = 'none';
        statusText.textContent = 'LLM mode running...';
    }
});

rlBtn.addEventListener('click', () => {
    if (rlAgent) {
        activeAgent = rlAgent;
        rlAgent.run();
        turboBtn.disabled = true;
        llmBtn.disabled = true;
        rlBtn.disabled = true;
        stopBtn.disabled = false;
        rlPanel.style.display = 'block';
        statusText.textContent = 'RL+LLM mode running...';
    }
});

stopBtn.addEventListener('click', () => {
    if (activeAgent) {
        activeAgent.stop();
        activeAgent = null;
    }
    if (agent) {
        agent.stop();
    }
    if (rlAgent) {
        rlAgent.stop();
    }
    turboBtn.disabled = false;
    llmBtn.disabled = !llmInitialized;
    rlBtn.disabled = !llmInitialized;
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
        // Record if in recording mode
        if (dataCollector?.isRecording) {
            dataCollector.recordHumanAction(buttonName);
        }

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
        // Record if in recording mode
        if (dataCollector?.isRecording) {
            dataCollector.recordHumanAction(buttonName);
        }

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
    // Don't capture keys when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    const button = keyMap[e.key];
    if (button) {
        // Record if in recording mode
        if (dataCollector?.isRecording) {
            dataCollector.recordHumanAction(button);
        }

        if (agent && agent.running) {
            agent.manualButton(button);
        } else if (emulator) {
            emulator.pressButton(button);
        }
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

// RL controls
explorationSlider.addEventListener('input', (e) => {
    const rate = parseInt(e.target.value) / 100;
    if (rlAgent) {
        rlAgent.setExplorationRate(rate);
    }
    rlExplorationSpan.textContent = `${e.target.value}%`;
});

exportRlBtn.addEventListener('click', () => {
    if (rlAgent) {
        const data = rlAgent.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tesserack-rl-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        statusText.textContent = 'RL data exported!';
    }
});

// Data collection controls
exploreBtn.addEventListener('click', () => {
    if (dataCollector) {
        // Disable other modes
        turboBtn.disabled = true;
        llmBtn.disabled = true;
        rlBtn.disabled = true;
        exploreBtn.disabled = true;
        recordBtn.disabled = true;
        stopCollectBtn.disabled = false;

        statusText.textContent = 'Random exploration running...';
        dataCollector.startExploration(0);  // 0 = unlimited
    }
});

recordBtn.addEventListener('click', () => {
    if (dataCollector) {
        if (dataCollector.isRecording) {
            // Stop recording
            dataCollector.stopRecording();
            recordBtn.classList.remove('recording');
            recordBtn.textContent = 'Record Me';
            stopCollectBtn.disabled = true;
            exploreBtn.disabled = false;
            statusText.textContent = 'Recording stopped.';
        } else {
            // Start recording
            dataCollector.startRecording();
            recordBtn.classList.add('recording');
            recordBtn.textContent = 'Stop Recording';
            exploreBtn.disabled = true;
            stopCollectBtn.disabled = false;
            statusText.textContent = 'Recording your inputs - play the game!';
        }
    }
});

stopCollectBtn.addEventListener('click', () => {
    if (dataCollector) {
        dataCollector.stop();
    }
    // Re-enable buttons
    turboBtn.disabled = false;
    llmBtn.disabled = !llmInitialized;
    rlBtn.disabled = !llmInitialized;
    exploreBtn.disabled = false;
    recordBtn.disabled = false;
    recordBtn.classList.remove('recording');
    recordBtn.textContent = 'Record Me';
    stopCollectBtn.disabled = true;
    collectStatus.textContent = 'Stopped.';
    collectStatus.classList.remove('active');
    statusText.textContent = 'Data collection stopped.';
});

exportTrainingBtn.addEventListener('click', () => {
    if (dataCollector) {
        const data = dataCollector.exportForTraining();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pokemon-training-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        statusText.textContent = `Exported ${data.data.length} training samples!`;
    }
});

clearDataBtn.addEventListener('click', () => {
    if (dataCollector && confirm('Clear all collected data?')) {
        dataCollector.clear();
        exploreCountSpan.textContent = '0';
        humanCountSpan.textContent = '0';
        collectRewardSpan.textContent = '0';
        collectStatus.textContent = 'Data cleared.';
        exportTrainingBtn.disabled = true;
        clearDataBtn.disabled = true;
        statusText.textContent = 'Data cleared.';
    }
});

console.log('Tesserack ready');
