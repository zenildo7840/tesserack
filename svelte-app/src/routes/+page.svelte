<script>
    import { onMount } from 'svelte';
    import { Info, Github, ExternalLink } from 'lucide-svelte';

    // Components
    import Header from '$lib/components/Header.svelte';
    import GameCanvas from '$lib/components/GameCanvas.svelte';
    import ModeSelector from '$lib/components/ModeSelector.svelte';
    import GameStateBar from '$lib/components/GameStateBar.svelte';
    import AIPanel from '$lib/components/AIPanel.svelte';
    import ProgressBar from '$lib/components/ProgressBar.svelte';
    import GameControls from '$lib/components/GameControls.svelte';
    import HintInput from '$lib/components/HintInput.svelte';
    import ActivityFeed from '$lib/components/ActivityFeed.svelte';
    import AdvancedPanel from '$lib/components/AdvancedPanel.svelte';
    import LLMConfig from '$lib/components/LLMConfig.svelte';
    import RomDropzone from '$lib/components/RomDropzone.svelte';
    import ModelStatus from '$lib/components/ModelStatus.svelte';

    // Stores
    import { romLoaded, gameState } from '$lib/stores/game';
    import { activeMode } from '$lib/stores/agent';
    import { modelState } from '$lib/stores/training';
    import { feedSystem } from '$lib/stores/feed';

    onMount(() => {
        feedSystem('Welcome to Tesserack! Drop a Pokemon Red ROM to begin.');
    });
</script>

<div class="app">
    <Header />

    <LLMConfig />

    <main class="main-content">
        <div class="left-column">
            {#if !$romLoaded}
                <RomDropzone />
            {:else}
                <GameCanvas />
            {/if}

            <ProgressBar />

            {#if $romLoaded}
                <GameControls />
                <HintInput />
            {/if}
        </div>

        <div class="right-column">
            {#if $romLoaded}
                <ModeSelector />
                <ModelStatus />
                <GameStateBar />
                <AIPanel />
            {/if}

            <ActivityFeed />
        </div>
    </main>

    <AdvancedPanel />

    <footer class="info-footer">
        <Info size={14} />
        <p>
            All data is stored locally in your browser. Your training progress, experiences, and AI model persist across sessions but are specific to this browser and device. Use the Export function to back up your data or transfer it elsewhere.
        </p>
    </footer>

    <footer class="credits-footer">
        <span>Made by Sid Mohan</span>
        <div class="credits-links">
            <a href="https://github.com/sidmohan0" target="_blank" rel="noopener noreferrer">
                <Github size={14} />
                <span>GitHub</span>
            </a>
            <a href="https://threadfork.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                <span>Threadfork</span>
            </a>
            <a href="https://datafog.ai" target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                <span>DataFog</span>
            </a>
        </div>
    </footer>
</div>

<style>
    .app {
        max-width: 1100px;
        margin: 0 auto;
        padding: 16px 12px;
        min-height: 100vh;
    }

    .main-content {
        display: grid;
        grid-template-columns: 400px 1fr;
        gap: 20px;
        margin-top: 16px;
    }

    .left-column {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .right-column {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    @media (max-width: 900px) {
        .main-content {
            grid-template-columns: 1fr;
        }
    }

    .info-footer {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-top: 24px;
        padding: 12px 16px;
        background: var(--bg-input);
        border-radius: 8px;
        color: var(--text-muted);
        font-size: 12px;
        line-height: 1.5;
    }

    .info-footer p {
        margin: 0;
    }

    .info-footer :global(svg) {
        flex-shrink: 0;
        margin-top: 2px;
    }

    .credits-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 16px;
        padding: 12px;
        font-size: 12px;
        color: var(--text-muted);
    }

    .credits-footer span {
        font-weight: 500;
    }

    .credits-links {
        display: flex;
        gap: 16px;
    }

    .credits-links a {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text-secondary);
        text-decoration: none;
        transition: color 0.15s;
    }

    .credits-links a:hover {
        color: var(--accent-primary);
    }
</style>
