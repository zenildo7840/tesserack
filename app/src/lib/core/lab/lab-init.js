/**
 * Lab Mode Initialization
 *
 * Initializes game systems for Lab mode with GuideAgent integration.
 * Supports two modes:
 *   - 'llm': GuideAgent with LLM calls (default)
 *   - 'purerl': PureRLAgent with deterministic rewards only
 */

import { get, writable } from 'svelte/store';
import { Emulator } from '../emulator.js';
import { MemoryReader } from '../memory-reader.js';
import { GuideAgent } from './guide-agent.js';
import { PureRLAgent } from './pure-rl-agent.js';
import { CombinedRewardSystem } from '../adaptive-rewards.js';
import { feedSystem } from '$lib/stores/feed';
import {
    walkthroughGraph,
    currentGraphLocation,
    labMetrics,
    updateLocation,
    recordStep,
    loadWalkthroughGraph
} from '$lib/stores/lab';
import { gameState, updateGameState } from '$lib/stores/game';

// Lab mode instances
let labEmulator = null;
let labReader = null;
let labAgent = null;
let labPureRLAgent = null;  // Pure RL agent instance
let labRewardSystem = null;
let labCanvas = null;
let isInitialized = false;
let labSpeed = 1; // Playback speed multiplier

// Current mode: 'llm' or 'purerl'
export const labMode = writable('llm');
let currentMode = 'llm';

// Pure RL metrics store
export const pureRLMetrics = writable({
    step: 0,
    action: null,
    reward: 0,
    totalReward: 0,
    epsilon: 0.3,
    breakdown: { tier1: 0, tier2: 0, tier3: 0, penalties: 0 },
    firedTests: []
});

/**
 * Handle agent updates - sync with lab stores
 */
function handleLabAgentUpdate(update) {
    // Update game state
    if (update.state) {
        updateGameState(update.state);
    }

    // Update location on graph
    if (update.state?.location) {
        updateLocation(update.state.location);
    }

    // Report errors to activity feed
    if (update.error) {
        const errorMsg = update.error;
        if (errorMsg.includes('WebLLM not initialized')) {
            feedSystem('LLM Error: Browser model not loaded. Select a model in the header.');
        } else if (errorMsg.includes('No model configured')) {
            feedSystem('LLM Error: No model selected. Configure in the Model dropdown.');
        } else if (errorMsg.includes('No endpoint configured')) {
            feedSystem('LLM Error: No API endpoint configured.');
        } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
            feedSystem('LLM Error: Invalid API key. Check your key in Model settings.');
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
            feedSystem('LLM Error: Rate limited. Wait a moment and try again.');
        } else {
            feedSystem(`LLM Error: ${errorMsg.slice(0, 80)}`);
        }
    }

    // Log successful LLM calls with plan info
    if (update.reasoning && !update.error && update.plansGenerated > 0) {
        // Only log occasionally to avoid spam
        const metrics = get(labMetrics);
        if (metrics.llmCalls % 5 === 1) {
            feedSystem(`Plan: ${update.reasoning.slice(0, 60)}...`);
        }
    }

    // Record step metrics
    if (update.action) {
        const reward = labRewardSystem?.getLastReward() || 0;
        recordStep(reward);
    }
}

/**
 * Handle pure RL agent step updates
 */
function handlePureRLStep(stepData) {
    // Update pure RL metrics store
    pureRLMetrics.set({
        step: stepData.step,
        action: stepData.action,
        reward: stepData.reward,
        totalReward: stepData.totalReward,
        epsilon: stepData.epsilon,
        breakdown: stepData.breakdown,
        firedTests: stepData.firedTests
    });

    // Update game state
    if (stepData.state) {
        updateGameState(stepData.state);
    }

    // Update location on graph
    if (stepData.state?.location) {
        updateLocation(stepData.state.location);
    }

    // Record step (use total from breakdown)
    recordStep(stepData.reward);

    // Log milestone rewards to feed
    if (stepData.firedTests.length > 0) {
        const tests = stepData.firedTests.filter(t => !t.includes('penalty'));
        if (tests.length > 0) {
            feedSystem(`RL: ${tests.join(', ')} (+${stepData.reward.toFixed(2)})`);
        }
    }
}

/**
 * Update game state from memory on each frame
 */
function updateLabGameState() {
    if (!labReader) return;

    const state = labReader.getGameState();
    updateGameState(state);

    // Update location tracking
    if (state.location) {
        const current = get(currentGraphLocation);
        if (state.location !== current) {
            updateLocation(state.location);
        }
    }
}

/**
 * Initialize Lab mode with a ROM buffer
 * @param {ArrayBuffer} romBuffer - ROM file data
 * @param {HTMLCanvasElement} canvas - Canvas element for rendering
 */
export async function initializeLab(romBuffer, canvas) {
    if (isInitialized) {
        console.log('[Lab] Already initialized');
        return { emulator: labEmulator, agent: labAgent, reader: labReader };
    }

    labCanvas = canvas;

    feedSystem('Initializing Lab mode...');

    try {
        // 1. Load walkthrough graph
        await loadWalkthroughGraph();

        // 2. Create emulator
        labEmulator = new Emulator(canvas);
        await labEmulator.loadROM(romBuffer);

        // 3. Create memory reader
        labReader = new MemoryReader(labEmulator);

        // 4. Create guide-enhanced agent (LLM mode)
        labAgent = new GuideAgent(labEmulator, labReader, handleLabAgentUpdate);

        // 5. Create reward system
        labRewardSystem = new CombinedRewardSystem(canvas, labReader);
        labAgent.setExternalRewardSource(labRewardSystem);

        // 6. Create pure RL agent
        labPureRLAgent = new PureRLAgent(labEmulator, labReader, {
            epsilonStart: 0.3,
            epsilonEnd: 0.05,
            epsilonDecay: 0.9995,
            actionHoldFrames: 12,
            frameSkip: 16,      // More frames per step = smoother movement
            actionRepeat: 3     // Repeat action 3 times before reconsidering
        });

        // 7. Start emulator
        labEmulator.frameCallback = updateLabGameState;
        labEmulator.start();

        isInitialized = true;

        feedSystem('Lab mode ready! Click Run to start the agent.');

        return { emulator: labEmulator, agent: labAgent, pureRLAgent: labPureRLAgent, reader: labReader };
    } catch (err) {
        console.error('[Lab] Initialization failed:', err);
        feedSystem(`Lab error: ${err.message}`);
        throw err;
    }
}

/**
 * Set the lab mode
 * @param {'llm' | 'purerl'} mode - The mode to switch to
 */
export function setLabMode(mode) {
    if (mode !== 'llm' && mode !== 'purerl') {
        console.error('[Lab] Invalid mode:', mode);
        return;
    }

    // Stop current agent before switching
    stopLabAgent();

    currentMode = mode;
    labMode.set(mode);

    if (mode === 'purerl') {
        feedSystem('Switched to Pure RL mode (no LLM calls)');
    } else {
        feedSystem('Switched to LLM mode (Guide-enhanced agent)');
    }
}

/**
 * Get current lab mode
 */
export function getLabMode() {
    return currentMode;
}

/**
 * Start the lab agent
 */
export function startLabAgent() {
    if (currentMode === 'purerl') {
        if (!labPureRLAgent) {
            console.error('[Lab] Pure RL agent not initialized');
            return false;
        }
        labPureRLAgent.running = true;
        runPureRLLoop();
    } else {
        if (!labAgent) {
            console.error('[Lab] Agent not initialized');
            return false;
        }
        labAgent.running = true;
        runLabLoop();
    }
    return true;
}

/**
 * Stop the lab agent
 */
export function stopLabAgent() {
    if (labAgent) {
        labAgent.running = false;
    }
    if (labPureRLAgent) {
        labPureRLAgent.stop();
    }
}

/**
 * Lab agent loop (LLM mode)
 */
async function runLabLoop() {
    if (!labAgent || !labAgent.running) return;

    try {
        await labAgent.step();
    } catch (err) {
        console.error('[Lab] Agent step error:', err);
    }

    // Continue loop with speed adjustment
    if (labAgent.running) {
        const interval = Math.max(10, 100 / labSpeed); // Faster with higher speed
        setTimeout(runLabLoop, interval);
    }
}

/**
 * Pure RL agent loop
 */
async function runPureRLLoop() {
    if (!labPureRLAgent || !labPureRLAgent.running) return;

    try {
        const result = await labPureRLAgent.step();
        // Get current state for the callback
        const state = labReader?.getGameState();
        handlePureRLStep({
            step: labPureRLAgent.totalSteps,
            action: result.action,
            reward: result.reward,
            totalReward: labPureRLAgent.totalReward,
            epsilon: labPureRLAgent.epsilon,
            breakdown: result.breakdown,
            firedTests: result.firedTests,
            state
        });
    } catch (err) {
        console.error('[Lab] Pure RL step error:', err);
    }

    // Continue loop with speed adjustment (faster for pure RL)
    if (labPureRLAgent.running) {
        const interval = Math.max(1, 50 / labSpeed); // Faster base speed for RL
        setTimeout(runPureRLLoop, interval);
    }
}

/**
 * Set playback speed
 * @param {number} speed - Speed multiplier (1, 2, 4, 8)
 */
export function setLabSpeed(speed) {
    labSpeed = speed;
    console.log(`[Lab] Speed set to ${speed}x`);
}

/**
 * Step one frame (for manual stepping)
 */
export async function stepLabAgent() {
    if (currentMode === 'purerl') {
        if (!labPureRLAgent) {
            console.error('[Lab] Pure RL agent not initialized');
            return false;
        }
        try {
            const result = await labPureRLAgent.step();
            const state = labReader?.getGameState();
            handlePureRLStep({
                step: labPureRLAgent.totalSteps,
                action: result.action,
                reward: result.reward,
                totalReward: labPureRLAgent.totalReward,
                epsilon: labPureRLAgent.epsilon,
                breakdown: result.breakdown,
                firedTests: result.firedTests,
                state
            });
            return true;
        } catch (err) {
            console.error('[Lab] Pure RL step error:', err);
            return false;
        }
    } else {
        if (!labAgent) {
            console.error('[Lab] Agent not initialized');
            return false;
        }
        try {
            await labAgent.step();
            return true;
        } catch (err) {
            console.error('[Lab] Step error:', err);
            return false;
        }
    }
}

/**
 * Reset lab mode
 */
export function resetLab() {
    stopLabAgent();

    labMetrics.update(m => ({
        ...m,
        totalSteps: 0,
        llmCalls: 0,
        objectivesCompleted: 0,
        guideAdherenceScore: 0,
        currentReward: 0,
        episodeReward: 0
    }));

    // Reset pure RL agent
    if (labPureRLAgent) {
        labPureRLAgent.reset();
    }

    // Reset pure RL metrics store
    pureRLMetrics.set({
        step: 0,
        action: null,
        reward: 0,
        totalReward: 0,
        epsilon: 0.3,
        breakdown: { tier1: 0, tier2: 0, tier3: 0, penalties: 0 },
        firedTests: []
    });
}

/**
 * Get current lab instances
 */
export function getLabInstances() {
    return {
        emulator: labEmulator,
        agent: labAgent,
        pureRLAgent: labPureRLAgent,
        reader: labReader,
        rewardSystem: labRewardSystem,
        isInitialized,
        currentMode
    };
}

/**
 * Check if lab is initialized
 */
export function isLabInitialized() {
    return isInitialized;
}

/**
 * Cleanup lab mode
 */
export function cleanupLab() {
    stopLabAgent();

    if (labEmulator) {
        labEmulator.stop();
    }

    labEmulator = null;
    labReader = null;
    labAgent = null;
    labPureRLAgent = null;
    labRewardSystem = null;
    labCanvas = null;
    isInitialized = false;
    currentMode = 'llm';
    labMode.set('llm');
}
