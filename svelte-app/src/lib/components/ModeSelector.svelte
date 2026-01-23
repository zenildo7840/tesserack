<script>
    import { activeMode } from '$lib/stores/agent';
    import { startWatchMode, stopAll } from '$lib/core/game-init.js';
    import { Play, Eye, Square } from 'lucide-svelte';
    import PotionProgress from './PotionProgress.svelte';

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
            }
            // Manual mode doesn't need to start anything
        }
    }

    function stop() {
        stopAll();
        activeMode.set('idle');
    }

    $: isRunning = $activeMode !== 'idle';
</script>

<div class="mode-selector panel">
    <div class="controls">
        <button
            class="control-btn watch"
            class:active={$activeMode === 'watch'}
            on:click={() => selectMode('watch')}
            title="Watch AI play"
        >
            <Eye size={18} />
            <span>Watch</span>
        </button>

        <button
            class="control-btn play"
            class:active={$activeMode === 'manual'}
            on:click={() => selectMode('manual')}
            title="Play manually"
        >
            <Play size={18} />
            <span>Play</span>
        </button>

        <button
            class="control-btn stop"
            class:visible={isRunning}
            on:click={stop}
            title="Stop"
        >
            <Square size={16} />
            <span>Stop</span>
        </button>
    </div>

    <PotionProgress />
</div>

<style>
    .mode-selector {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .controls {
        display: flex;
        gap: 8px;
    }

    .control-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        border-radius: var(--border-radius);
        transition: all 0.15s ease;
    }

    .control-btn.watch {
        background: var(--bg-input);
        color: var(--text-secondary);
    }

    .control-btn.watch:hover {
        background: var(--bg-dark);
        color: var(--text-primary);
    }

    .control-btn.watch.active {
        background: var(--accent-primary);
        color: white;
    }

    .control-btn.play {
        background: var(--bg-input);
        color: var(--text-secondary);
    }

    .control-btn.play:hover {
        background: var(--bg-dark);
        color: var(--text-primary);
    }

    .control-btn.play.active {
        background: var(--accent-success);
        color: white;
    }

    .control-btn.stop {
        background: var(--accent-secondary);
        color: white;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease;
    }

    .control-btn.stop.visible {
        opacity: 1;
        pointer-events: auto;
    }

    .control-btn.stop:hover {
        background: #ff8787;
    }
</style>
