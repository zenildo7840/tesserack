// LLM state store - manages WebLLM loading and status
import { writable, derived } from 'svelte/store';

export const llmState = writable({
    status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
    progress: 0,
    message: '',
    modelName: 'Qwen2.5-1.5B-Instruct',
    error: null,
});

// Token statistics store
export const tokenStats = writable({
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    lastRequestTokens: 0,
    lastTokensPerSecond: 0,
    avgTokensPerSecond: 0,
    // For calculating averages
    totalGenerationTime: 0,
});

export const isLLMReady = derived(llmState, $state => $state.status === 'ready');
export const isLLMLoading = derived(llmState, $state => $state.status === 'loading');

export function updateLLMState(update) {
    llmState.update(state => ({ ...state, ...update }));
}

export function setLLMProgress(progress) {
    llmState.update(state => ({
        ...state,
        status: 'loading',
        progress: progress.progress || 0,
        message: progress.text || 'Loading model...',
    }));
}

export function setLLMReady() {
    llmState.update(state => ({
        ...state,
        status: 'ready',
        progress: 1,
        message: 'Model ready',
    }));
}

export function setLLMError(error) {
    llmState.update(state => ({
        ...state,
        status: 'error',
        error: error.message || error,
        message: 'Failed to load model',
    }));
}

/**
 * Record token usage from a completion
 * @param {Object} usage - {prompt_tokens, completion_tokens, total_tokens}
 * @param {number} durationMs - Time taken for generation in milliseconds
 */
export function recordTokenUsage(usage, durationMs) {
    if (!usage) return;

    const completionTokens = usage.completion_tokens || 0;
    const tokensPerSecond = durationMs > 0 ? (completionTokens / (durationMs / 1000)) : 0;

    tokenStats.update(stats => {
        const newTotalGenTime = stats.totalGenerationTime + durationMs;
        const newTotalCompletion = stats.totalCompletionTokens + completionTokens;
        const avgTps = newTotalGenTime > 0 ? (newTotalCompletion / (newTotalGenTime / 1000)) : 0;

        return {
            totalPromptTokens: stats.totalPromptTokens + (usage.prompt_tokens || 0),
            totalCompletionTokens: newTotalCompletion,
            totalTokens: stats.totalTokens + (usage.total_tokens || 0),
            requestCount: stats.requestCount + 1,
            lastRequestTokens: completionTokens,
            lastTokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
            avgTokensPerSecond: Math.round(avgTps * 10) / 10,
            totalGenerationTime: newTotalGenTime,
        };
    });
}
