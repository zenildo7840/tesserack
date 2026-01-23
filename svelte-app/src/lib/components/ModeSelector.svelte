<script>
    import { activeMode } from '$lib/stores/agent';
    import { startWatchMode, startTrainMode, stopAll } from '$lib/core/game-init.js';
    import { Bot, Brain, Gamepad2, Square } from 'lucide-svelte';

    const modes = [
        { id: 'watch', label: 'Watch AI', icon: Bot },
        { id: 'train', label: 'Train', icon: Brain },
        { id: 'manual', label: 'Play', icon: Gamepad2 },
    ];

    function selectMode(mode) {
        if ($activeMode === mode) {
            // Toggle off
            stopAll();
            activeMode.set('idle');
        } else {
            // Stop current mode first
            stopAll();
            activeMode.set(mode);

            if (mode === 'watch') {
                startWatchMode();
            } else if (mode === 'train') {
                startTrainMode();
            }
            // Manual mode doesn't need to start anything
        }
    }

    function stop() {
        stopAll();
        activeMode.set('idle');
    }
</script>

<div class="mode-selector panel">
    <div class="mode-group">
        {#each modes as mode}
            <button
                class="mode-btn"
                class:active={$activeMode === mode.id}
                class:training={mode.id === 'train' && $activeMode === 'train'}
                on:click={() => selectMode(mode.id)}
            >
                <svelte:component this={mode.icon} size={16} />
                <span class="mode-label">{mode.label}</span>
            </button>
        {/each}
    </div>

    {#if $activeMode !== 'idle'}
        <button class="stop-btn" on:click={stop}>
            <Square size={14} />
            Stop
        </button>
    {/if}
</div>

<style>
    .mode-selector {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .mode-group {
        flex: 1;
    }

    .mode-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }

    .mode-label {
        font-size: 13px;
    }

    .stop-btn {
        background: var(--accent-secondary);
        color: white;
        padding: 10px 20px;
    }

    .stop-btn:hover {
        background: #ff8787;
    }
</style>
