<script>
    import { stats } from '$lib/stores/agent';
    import { modelState, trainingProgress } from '$lib/stores/training';

    // Auto-train thresholds
    const thresholds = [3000, 7000, 15000, 30000, 60000, 100000];

    $: currentThreshold = thresholds.find(t => t > $stats.experiences) || 100000;
    $: prevThreshold = thresholds[thresholds.indexOf(currentThreshold) - 1] || 0;
    $: progress = Math.min(100, (($stats.experiences - prevThreshold) / (currentThreshold - prevThreshold)) * 100);
    $: isTraining = $trainingProgress.active;
    $: level = $modelState.sessions || 0;
</script>

<div class="potion-container" title="{$stats.experiences.toLocaleString()} / {currentThreshold.toLocaleString()} experiences">
    <div class="potion">
        <!-- Bottle shape -->
        <div class="bottle-neck"></div>
        <div class="bottle-body">
            <!-- Liquid fill -->
            <div
                class="liquid"
                class:training={isTraining}
                style="height: {progress}%"
            >
                {#if isTraining}
                    <div class="bubbles">
                        <span class="bubble"></span>
                        <span class="bubble"></span>
                        <span class="bubble"></span>
                    </div>
                {/if}
            </div>
        </div>
        <!-- Cork/cap -->
        <div class="cork"></div>
    </div>

    <div class="potion-info">
        {#if isTraining}
            <span class="status training">Brewing...</span>
        {:else if level > 0}
            <span class="status">Lv.{level}</span>
        {:else}
            <span class="status">{Math.round(progress)}%</span>
        {/if}
    </div>
</div>

<style>
    .potion-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        cursor: help;
    }

    .potion {
        position: relative;
        width: 32px;
        height: 44px;
    }

    .cork {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 14px;
        height: 6px;
        background: #8B4513;
        border-radius: 2px 2px 0 0;
        z-index: 3;
    }

    .bottle-neck {
        position: absolute;
        top: 5px;
        left: 50%;
        transform: translateX(-50%);
        width: 12px;
        height: 10px;
        background: rgba(200, 220, 255, 0.3);
        border: 2px solid var(--border-color);
        border-bottom: none;
        border-radius: 2px 2px 0 0;
        z-index: 2;
    }

    .bottle-body {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 28px;
        height: 30px;
        background: rgba(200, 220, 255, 0.2);
        border: 2px solid var(--border-color);
        border-radius: 4px 4px 8px 8px;
        overflow: hidden;
        z-index: 1;
    }

    .liquid {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, #74b9ff, #a29bfe);
        border-radius: 0 0 6px 6px;
        transition: height 0.5s ease;
    }

    .liquid.training {
        background: linear-gradient(to top, #00b894, #55efc4);
        animation: glow 1s ease-in-out infinite alternate;
    }

    @keyframes glow {
        from { box-shadow: inset 0 0 5px rgba(0, 184, 148, 0.5); }
        to { box-shadow: inset 0 0 10px rgba(85, 239, 196, 0.8); }
    }

    .bubbles {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 100%;
    }

    .bubble {
        position: absolute;
        width: 4px;
        height: 4px;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        animation: rise 1.5s ease-in infinite;
    }

    .bubble:nth-child(1) { left: 20%; animation-delay: 0s; }
    .bubble:nth-child(2) { left: 50%; animation-delay: 0.5s; }
    .bubble:nth-child(3) { left: 75%; animation-delay: 1s; }

    @keyframes rise {
        0% { bottom: 0; opacity: 0; }
        20% { opacity: 1; }
        100% { bottom: 100%; opacity: 0; }
    }

    .potion-info {
        font-size: 10px;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .status.training {
        color: var(--accent-success);
        animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
</style>
