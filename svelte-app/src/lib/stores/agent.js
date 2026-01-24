// Agent state store - manages AI agent state and modes
import { writable, derived } from 'svelte/store';

// Active mode: 'idle' | 'watch' | 'train' | 'manual'
export const activeMode = writable('idle');

// Agent instances (held, not reactive)
export const gameAgent = writable(null);
export const rlAgent = writable(null);
export const dataCollector = writable(null);

// AI reasoning state
export const aiState = writable({
    objective: '',
    objectiveHint: '',
    reasoning: '',
    actions: [],
    planSource: '', // 'llm' | 'neural-policy' | 'exploration'
    gameState: null, // Current game state for visibility
});

// Statistics
export const stats = writable({
    totalReward: 0,
    experiences: 0,
    mapsVisited: 0,
    explorationSteps: 0,
    humanDemos: 0,
});

// User hint
export const userHint = writable('');
export const hintRemaining = writable(0);

// Is agent running?
export const isRunning = derived(activeMode, $mode => $mode !== 'idle' && $mode !== 'manual');

// Update AI state
export function updateAIState(update) {
    aiState.update(state => ({ ...state, ...update }));
}

// Update stats
export function updateStats(update) {
    stats.update(s => ({ ...s, ...update }));
}

// Set hint
export function setHint(hint, duration = 5) {
    userHint.set(hint);
    hintRemaining.set(duration);
}

// Clear hint
export function clearHint() {
    userHint.set('');
    hintRemaining.set(0);
}
