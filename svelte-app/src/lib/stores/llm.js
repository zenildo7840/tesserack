// LLM state store - manages WebLLM loading and status
import { writable, derived } from 'svelte/store';

export const llmState = writable({
    status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
    progress: 0,
    message: '',
    modelName: 'Qwen2.5-1.5B-Instruct',
    error: null,
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
