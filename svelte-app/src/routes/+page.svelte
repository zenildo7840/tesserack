<script>
    import { onMount } from 'svelte';

    // Components
    import Header from '$lib/components/Header.svelte';
    import GameCanvas from '$lib/components/GameCanvas.svelte';
    import ModeSelector from '$lib/components/ModeSelector.svelte';
    import AIPanel from '$lib/components/AIPanel.svelte';
    import ProgressBar from '$lib/components/ProgressBar.svelte';
    import GameControls from '$lib/components/GameControls.svelte';
    import HintInput from '$lib/components/HintInput.svelte';
    import ActivityFeed from '$lib/components/ActivityFeed.svelte';
    import AdvancedPanel from '$lib/components/AdvancedPanel.svelte';
    import RomDropzone from '$lib/components/RomDropzone.svelte';

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
                <AIPanel />
            {/if}

            <ActivityFeed />
        </div>
    </main>

    {#if $romLoaded}
        <AdvancedPanel />
    {/if}
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
</style>
