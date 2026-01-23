<script>
    import { activeMode, aiState, stats } from '$lib/stores/agent';
    import { trainingProgress } from '$lib/stores/training';
    import { Brain, Sparkles } from 'lucide-svelte';

    $: isRunning = $activeMode !== 'idle';
</script>

<div class="ai-panel panel">
    {#if $trainingProgress.active}
        <!-- Training in progress -->
        <div class="panel-header">
            <Sparkles size={16} class="header-icon training" />
            <span class="panel-title">Training Model</span>
        </div>

        <div class="training-status">
            <div class="progress-text">{$trainingProgress.message}</div>
            <div class="progress-bar">
                <div
                    class="progress-fill"
                    style="width: {($trainingProgress.epoch / $trainingProgress.totalEpochs) * 100}%"
                ></div>
            </div>
            {#if $trainingProgress.accuracy}
                <div class="training-metric">
                    Accuracy: {($trainingProgress.accuracy * 100).toFixed(1)}%
                </div>
            {/if}
        </div>

    {:else if isRunning}
        <!-- AI is running -->
        <div class="panel-header">
            <Brain size={16} class="header-icon active" />
            <span class="panel-title">AI Thinking</span>
        </div>

        <div class="objective">
            {$aiState.objective || 'Analyzing game state...'}
        </div>

        <div class="reasoning">
            {$aiState.reasoning || 'Deciding next action...'}
        </div>

        {#if $aiState.actions.length > 0}
            <div class="actions">
                <span class="actions-label">Actions:</span>
                <span class="actions-list">{$aiState.actions.join(', ')}</span>
            </div>
        {/if}

        {#if $aiState.planSource}
            <div class="source">
                via {$aiState.planSource}
            </div>
        {/if}

    {:else}
        <!-- Idle state -->
        <div class="panel-header">
            <Brain size={16} class="header-icon" />
            <span class="panel-title">AI Status</span>
        </div>

        <div class="idle-content">
            <p class="idle-message">Press <strong>Start</strong> to let the AI play.</p>
            <p class="idle-hint">You can use the gamepad anytime, whether AI is running or not.</p>
        </div>
    {/if}
</div>

<style>
    .ai-panel {
        min-height: 140px;
    }

    .panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .panel-header :global(.header-icon) {
        color: var(--text-muted);
    }

    .panel-header :global(.header-icon.active) {
        color: var(--accent-primary);
        animation: pulse-icon 2s ease-in-out infinite;
    }

    .panel-header :global(.header-icon.training) {
        color: var(--accent-success);
        animation: pulse-icon 1s ease-in-out infinite;
    }

    @keyframes pulse-icon {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .panel-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-secondary);
    }

    .objective {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 8px;
    }

    .reasoning {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.5;
        margin-bottom: 12px;
    }

    .actions {
        background: var(--bg-input);
        padding: 10px 12px;
        border-radius: var(--border-radius-sm);
        font-size: 13px;
    }

    .actions-label {
        color: var(--text-muted);
        margin-right: 8px;
    }

    .actions-list {
        color: var(--accent-primary);
        font-weight: 500;
        font-family: monospace;
    }

    .source {
        margin-top: 8px;
        font-size: 11px;
        color: var(--text-muted);
    }

    .training-status {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .progress-bar {
        height: 6px;
        background: var(--bg-dark);
        border-radius: 3px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-success), #55efc4);
        transition: width 0.3s;
    }

    .progress-text {
        font-size: 13px;
        color: var(--text-secondary);
    }

    .training-metric {
        font-size: 12px;
        color: var(--accent-success);
        font-weight: 500;
    }

    .idle-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .idle-message {
        font-size: 14px;
        color: var(--text-primary);
        margin: 0;
    }

    .idle-message strong {
        color: var(--accent-primary);
    }

    .idle-hint {
        font-size: 12px;
        color: var(--text-muted);
        margin: 0;
    }
</style>
