/**
 * Pure RL Agent - Runs RL without LLM calls.
 *
 * Uses epsilon-greedy action selection with a simple policy network.
 * Rewards come from deterministic unit tests (UnitTestRewards).
 */

import { UnitTestRewards } from './unit-test-rewards.js';

// Available actions
const ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b'];

/**
 * Simple feed-forward policy network in plain JS.
 * Architecture: input(stateSize) -> hidden(64) -> output(6 actions)
 */
class SimplePolicy {
    constructor(stateSize = 16, hiddenSize = 64) {
        this.stateSize = stateSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = ACTIONS.length;

        // Initialize weights with small random values
        this.w1 = this.randomMatrix(stateSize, hiddenSize, 0.1);
        this.b1 = new Float32Array(hiddenSize);
        this.w2 = this.randomMatrix(hiddenSize, this.outputSize, 0.1);
        this.b2 = new Float32Array(this.outputSize);
    }

    randomMatrix(rows, cols, scale = 1.0) {
        const mat = new Float32Array(rows * cols);
        for (let i = 0; i < mat.length; i++) {
            mat[i] = (Math.random() - 0.5) * 2 * scale;
        }
        return mat;
    }

    /**
     * Forward pass: state -> action probabilities
     */
    forward(stateVec) {
        // Hidden layer: ReLU(state * W1 + b1)
        const hidden = new Float32Array(this.hiddenSize);
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.b1[j];
            for (let i = 0; i < this.stateSize; i++) {
                sum += stateVec[i] * this.w1[i * this.hiddenSize + j];
            }
            hidden[j] = Math.max(0, sum);  // ReLU
        }

        // Output layer: softmax(hidden * W2 + b2)
        const logits = new Float32Array(this.outputSize);
        let maxLogit = -Infinity;
        for (let j = 0; j < this.outputSize; j++) {
            let sum = this.b2[j];
            for (let i = 0; i < this.hiddenSize; i++) {
                sum += hidden[i] * this.w2[i * this.outputSize + j];
            }
            logits[j] = sum;
            maxLogit = Math.max(maxLogit, sum);
        }

        // Softmax with numerical stability
        const probs = new Float32Array(this.outputSize);
        let sumExp = 0;
        for (let j = 0; j < this.outputSize; j++) {
            probs[j] = Math.exp(logits[j] - maxLogit);
            sumExp += probs[j];
        }
        for (let j = 0; j < this.outputSize; j++) {
            probs[j] /= sumExp;
        }

        return probs;
    }

    /**
     * Select action using the policy.
     * Returns action index.
     */
    selectAction(stateVec) {
        const probs = this.forward(stateVec);
        // Sample from distribution
        const r = Math.random();
        let cumSum = 0;
        for (let i = 0; i < probs.length; i++) {
            cumSum += probs[i];
            if (r < cumSum) return i;
        }
        return probs.length - 1;
    }
}

/**
 * Encode game state into a fixed-size vector for the policy network.
 */
function encodeState(state) {
    if (!state) return new Float32Array(16);

    const vec = new Float32Array(16);
    let i = 0;

    // Position (normalized 0-1, assuming max 256)
    vec[i++] = (state.coordinates?.x ?? 0) / 256;
    vec[i++] = (state.coordinates?.y ?? 0) / 256;

    // Location hash (simple numeric encoding)
    const locHash = hashString(state.location || '') / 1000000;
    vec[i++] = locHash % 1;

    // Progress indicators
    vec[i++] = (state.badgeCount ?? 0) / 8;
    vec[i++] = (state.party?.length ?? 0) / 6;

    // Party stats
    if (state.party && state.party.length > 0) {
        const avgLevel = state.party.reduce((s, p) => s + (p.level || 0), 0) / state.party.length;
        vec[i++] = avgLevel / 100;

        const totalHP = state.party.reduce((s, p) => s + (p.currentHP || 0), 0);
        const maxHP = state.party.reduce((s, p) => s + (p.maxHP || 1), 0);
        vec[i++] = totalHP / Math.max(maxHP, 1);
    } else {
        vec[i++] = 0;
        vec[i++] = 0;
    }

    // Battle state
    vec[i++] = state.inBattle ? 1 : 0;

    // Dialog active
    vec[i++] = (state.dialog && state.dialog.length > 0) ? 1 : 0;

    // Money (log scale)
    vec[i++] = Math.log10((state.money || 0) + 1) / 6;

    // Pad remaining with zeros
    while (i < 16) vec[i++] = 0;

    return vec;
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Pure RL Agent - No LLM, just policy network + unit test rewards.
 */
export class PureRLAgent {
    constructor(emulator, memoryReader, config = {}) {
        this.emu = emulator;
        this.mem = memoryReader;

        // Config
        this.config = {
            epsilonStart: config.epsilonStart ?? 0.3,
            epsilonEnd: config.epsilonEnd ?? 0.05,
            epsilonDecay: config.epsilonDecay ?? 0.9995,
            actionHoldFrames: config.actionHoldFrames ?? 12,
            frameSkip: config.frameSkip ?? 16,  // Run more frames per step for smoother movement
            actionRepeat: config.actionRepeat ?? 3,  // Repeat same action to reduce jitter
            ...config
        };

        // Action repetition state
        this.currentAction = null;
        this.actionRepeatCount = 0;

        this.epsilon = this.config.epsilonStart;

        // Components
        this.policy = new SimplePolicy(16, 64);
        this.rewards = new UnitTestRewards(config.rewards || {});

        // State
        this.prevState = null;
        this.totalSteps = 0;
        this.totalReward = 0;
        this.running = false;
        this.lastAction = null;
        this.lastReward = null;
        this.lastBreakdown = null;

        // Callbacks
        this.onStep = null;  // Called after each step with metrics
    }

    /**
     * Execute one RL step.
     */
    async step() {
        // Get current state
        const currState = this.mem.getGameState();

        // Compute reward from transition (if we have previous state)
        let reward = 0;
        let breakdown = { tier1: 0, tier2: 0, tier3: 0, penalties: 0 };
        let firedTests = [];

        if (this.prevState) {
            const result = this.rewards.evaluate(this.prevState, currState);
            reward = result.total;
            breakdown = result.breakdown;
            firedTests = result.firedTests;
        }

        // Select action (with repetition for smoother movement)
        let action;

        if (this.currentAction && this.actionRepeatCount < this.config.actionRepeat) {
            // Repeat previous action
            action = this.currentAction;
            this.actionRepeatCount++;
        } else {
            // Select new action
            const stateVec = encodeState(currState);
            let actionIdx;

            if (Math.random() < this.epsilon) {
                // Explore: random action
                actionIdx = Math.floor(Math.random() * ACTIONS.length);
            } else {
                // Exploit: use policy
                actionIdx = this.policy.selectAction(stateVec);
            }

            action = ACTIONS[actionIdx];
            this.currentAction = action;
            this.actionRepeatCount = 1;
        }

        // Execute action
        await this.executeAction(action);

        // Update state
        this.prevState = currState;
        this.totalSteps++;
        this.totalReward += reward;
        this.lastAction = action;
        this.lastReward = reward;
        this.lastBreakdown = breakdown;

        // Decay epsilon
        this.epsilon = Math.max(
            this.config.epsilonEnd,
            this.epsilon * this.config.epsilonDecay
        );

        // Callback
        if (this.onStep) {
            this.onStep({
                step: this.totalSteps,
                action,
                reward,
                breakdown,
                firedTests,
                epsilon: this.epsilon,
                totalReward: this.totalReward,
                state: currState
            });
        }

        return { action, reward, breakdown, firedTests };
    }

    /**
     * Execute an action on the emulator.
     */
    async executeAction(action) {
        // Press button
        this.emu.pressButton(action, this.config.actionHoldFrames);

        // Run frames
        for (let i = 0; i < this.config.frameSkip; i++) {
            this.emu.runFrame();
        }
    }

    /**
     * Run the agent loop.
     */
    async run(stepCallback = null) {
        this.running = true;
        this.onStep = stepCallback;

        while (this.running) {
            await this.step();

            // Small delay to allow UI updates
            await new Promise(r => setTimeout(r, 1));
        }
    }

    /**
     * Stop the agent.
     */
    stop() {
        this.running = false;
    }

    /**
     * Reset the agent state.
     */
    reset() {
        this.prevState = null;
        this.totalSteps = 0;
        this.totalReward = 0;
        this.epsilon = this.config.epsilonStart;
        this.lastAction = null;
        this.lastReward = null;
        this.lastBreakdown = null;
        this.currentAction = null;
        this.actionRepeatCount = 0;
        this.rewards.reset();
    }

    /**
     * Get current metrics.
     */
    getMetrics() {
        return {
            totalSteps: this.totalSteps,
            totalReward: this.totalReward,
            epsilon: this.epsilon,
            lastAction: this.lastAction,
            lastReward: this.lastReward,
            lastBreakdown: this.lastBreakdown,
            rewardStats: this.rewards.getStats()
        };
    }
}

export default PureRLAgent;
