<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { Info, Github, ExternalLink, Gamepad2, FlaskConical } from 'lucide-svelte';

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
    import ModelStatus from '$lib/components/ModelStatus.svelte';
    import LabView from '$lib/components/lab/LabView.svelte';

    // Stores
    import { romLoaded, gameState } from '$lib/stores/game';
    import { activeMode } from '$lib/stores/agent';
    import { modelState } from '$lib/stores/training';
    import { feedSystem } from '$lib/stores/feed';

    // View mode: 'play' or 'lab' - restore from localStorage
    let viewMode = 'play';
    let mounted = false;

    onMount(() => {
        // Restore last view mode
        const savedMode = localStorage.getItem('tesserack_viewMode');
        if (savedMode === 'play' || savedMode === 'lab') {
            viewMode = savedMode;
        }
        mounted = true;

        feedSystem('Welcome to Tesserack! Drop a Pokemon Red ROM to begin.');
    });

    // Save view mode when it changes (only after initial mount)
    $: if (mounted && viewMode) {
        localStorage.setItem('tesserack_viewMode', viewMode);
    }
</script>

<div class="app">
    <Header />

    <!-- View Mode Toggle -->
    <div class="view-toggle">
        <button
            class="toggle-btn"
            class:active={viewMode === 'play'}
            on:click={() => viewMode = 'play'}
        >
            <Gamepad2 size={16} />
            <span>Play</span>
        </button>
        <button
            class="toggle-btn"
            class:active={viewMode === 'lab'}
            on:click={() => viewMode = 'lab'}
        >
            <FlaskConical size={16} />
            <span>Lab</span>
        </button>
    </div>

    {#if viewMode === 'lab'}
        <!-- Lab Mode -->
        <main class="lab-content">
            {#if !$romLoaded}
                <div class="lab-prompt">
                    <p>Load a ROM using the dropdown above to start Lab mode</p>
                </div>
            {/if}
            <div class="lab-layout">
                <div class="lab-main">
                    <LabView />
                </div>
                <div class="lab-sidebar">
                    <ActivityFeed />
                </div>
            </div>
        </main>
    {:else}
        <!-- Play Mode -->
        <main class="main-content">
            <div class="left-column">
                {#if !$romLoaded}
                    <div class="play-prompt">
                        <p>Load a ROM using the dropdown above to start playing</p>
                    </div>
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
            </div>
        </main>

        <AdvancedPanel />
    {/if}

    <!-- Activity Feed for Play mode (Lab mode has it in sidebar) -->
    {#if viewMode !== 'lab'}
        <div class="global-feed">
            <ActivityFeed />
        </div>
    {/if}

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

    .view-toggle {
        display: flex;
        gap: 4px;
        padding: 4px;
        background: var(--bg-input);
        border-radius: 8px;
        width: fit-content;
        margin: 16px auto 0;
    }

    .toggle-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: var(--text-muted);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
    }

    .toggle-btn:hover {
        color: var(--text-secondary);
    }

    .toggle-btn.active {
        background: var(--accent-primary);
        color: white;
    }

    .lab-content {
        margin-top: 16px;
        min-height: 600px;
    }

    .lab-layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 16px;
    }

    .lab-main {
        min-width: 0; /* Prevent grid blowout */
    }

    .lab-sidebar {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .lab-sidebar :global(.activity-feed) {
        position: sticky;
        top: 16px;
        max-height: calc(100vh - 150px);
    }

    .lab-sidebar :global(.feed-list) {
        max-height: calc(100vh - 250px);
    }

    @media (max-width: 1000px) {
        .lab-layout {
            grid-template-columns: 1fr;
        }

        .lab-sidebar {
            order: -1; /* Put feed above on mobile */
        }

        .lab-sidebar :global(.activity-feed) {
            position: static;
            max-height: 200px;
        }

        .lab-sidebar :global(.feed-list) {
            max-height: 160px;
        }
    }

    .lab-prompt,
    .play-prompt {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        background: var(--bg-panel);
        border: 2px dashed var(--border-color);
        border-radius: var(--border-radius);
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
    }

    .play-prompt {
        aspect-ratio: 160 / 144;
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

    /* Global Activity Feed */
    .global-feed {
        margin-top: 16px;
    }

    .global-feed :global(.activity-feed) {
        min-height: 120px;
        max-height: 200px;
    }

    .global-feed :global(.feed-list) {
        max-height: 160px;
    }
</style>
