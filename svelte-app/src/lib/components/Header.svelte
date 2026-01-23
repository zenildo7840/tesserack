<script>
    import { modelState } from '$lib/stores/training';
    import { romLoaded } from '$lib/stores/game';
    import { llmState, tokenStats } from '$lib/stores/llm';
    import { Cpu, CheckCircle, Info, Github, ChevronDown, ChevronUp, X, Zap } from 'lucide-svelte';

    let aboutOpen = false;

    $: hasTokenStats = $tokenStats.requestCount > 0;
</script>

<header class="header">
    <div class="logo">
        <div class="logo-icon">
            <Cpu size={24} />
        </div>
        <div class="logo-text">
            <h1>Tesserack</h1>
            <span class="tagline">AI Plays Pokemon</span>
        </div>
    </div>

    <div class="header-right">
        <button class="about-btn" on:click={() => aboutOpen = !aboutOpen}>
            <Info size={16} />
            <span>About</span>
            {#if aboutOpen}
                <ChevronUp size={14} />
            {:else}
                <ChevronDown size={14} />
            {/if}
        </button>

        {#if hasTokenStats}
            <div class="token-stats" title="Total: {$tokenStats.totalTokens.toLocaleString()} tokens across {$tokenStats.requestCount} requests">
                <Zap size={12} />
                <span class="tps">{$tokenStats.lastTokensPerSecond} tok/s</span>
                <span class="total">{($tokenStats.totalTokens / 1000).toFixed(1)}k</span>
            </div>
        {/if}

        {#if $romLoaded}
            {#if $modelState.hasModel}
                <span class="model-badge trained">
                    <CheckCircle size={14} />
                    Model v{$modelState.sessions}
                </span>
            {:else}
                <span class="model-badge untrained">
                    Untrained
                </span>
            {/if}
        {/if}
    </div>
</header>

{#if aboutOpen}
    <div class="about-panel">
        <button class="close-btn" on:click={() => aboutOpen = false}>
            <X size={16} />
        </button>

        <h2>How It Works</h2>

        <p>
            Tesserack runs a complete AI system <strong>entirely in your browser</strong>. No server, no API calls, no data leaves your machine.
        </p>

        <h3>Architecture</h3>
        <ul>
            <li><strong>Emulator:</strong> <a href="https://github.com/nicutor/nicutor.github.io" target="_blank" rel="noopener">binjgb</a> (WebAssembly GameBoy emulator)</li>
            <li><strong>LLM:</strong> Qwen2.5-1.5B via <a href="https://github.com/nicutor/nicutor.github.io" target="_blank" rel="noopener">WebLLM</a> (WebGPU-accelerated inference)</li>
            <li><strong>Policy Network:</strong> TensorFlow.js (learns from gameplay experiences)</li>
            <li><strong>Memory Reading:</strong> Direct RAM access to game state (badges, party, location, items)</li>
        </ul>

        <h3>The Loop</h3>
        <ol>
            <li>Read game state from emulator memory</li>
            <li>LLM generates 3 candidate action plans based on current objective</li>
            <li>Policy network + heuristics select the best plan</li>
            <li>Execute actions, observe reward, store experience</li>
            <li>Periodically train policy network on collected experiences</li>
        </ol>

        <h3>Curriculum</h3>
        <p>
            Objectives are extracted from <strong>Prima's Official Strategy Guide (1999)</strong>.
            The guide defines 47 ordered checkpoints from Pallet Town to the Hall of Fame.
            The LLM sees the next checkpoint in its prompt; the reward system gives bonuses for completing them.
        </p>

        <h3>What Gets Stored</h3>
        <p>
            Everything persists in IndexedDB and localStorage: experiences, trained model weights,
            checkpoint progress, game saves. The Qwen model (~1.5GB) is cached by your browser after first download.
        </p>

        <div class="about-footer">
            <a href="https://github.com/sidmohan0/tesserack" target="_blank" rel="noopener" class="github-link">
                <Github size={16} />
                <span>View Source on GitHub</span>
            </a>
        </div>
    </div>
{/if}

<style>
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-color);
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .logo-icon {
        color: var(--accent-primary);
    }

    .logo-text h1 {
        font-size: 22px;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        letter-spacing: -0.5px;
    }

    .tagline {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .about-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: var(--bg-input);
        color: var(--text-secondary);
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s;
    }

    .about-btn:hover {
        background: var(--bg-dark);
        color: var(--text-primary);
    }

    .model-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 500;
    }

    .model-badge.trained {
        background: rgba(39, 174, 96, 0.15);
        color: var(--accent-success);
    }

    .model-badge.untrained {
        background: var(--bg-input);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
    }

    .token-stats {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--bg-input);
        border-radius: 6px;
        font-size: 12px;
        color: var(--text-secondary);
        font-family: monospace;
    }

    .token-stats :global(svg) {
        color: var(--accent-primary);
    }

    .token-stats .tps {
        color: var(--text-primary);
        font-weight: 600;
    }

    .token-stats .total {
        color: var(--text-muted);
        padding-left: 8px;
        border-left: 1px solid var(--border-color);
    }

    .about-panel {
        position: relative;
        margin-top: 16px;
        padding: 20px 24px;
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-secondary);
    }

    .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 4px;
        color: var(--text-muted);
        border-radius: 4px;
        transition: all 0.15s;
    }

    .close-btn:hover {
        background: var(--bg-input);
        color: var(--text-primary);
    }

    .about-panel h2 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 12px 0;
    }

    .about-panel h3 {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 16px 0 8px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .about-panel p {
        margin: 0 0 12px 0;
    }

    .about-panel strong {
        color: var(--text-primary);
    }

    .about-panel ul, .about-panel ol {
        margin: 0 0 12px 0;
        padding-left: 20px;
    }

    .about-panel li {
        margin-bottom: 6px;
    }

    .about-panel a {
        color: var(--accent-primary);
        text-decoration: none;
    }

    .about-panel a:hover {
        text-decoration: underline;
    }

    .about-footer {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
    }

    .github-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: var(--bg-dark);
        color: var(--text-primary);
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.15s;
    }

    .github-link:hover {
        background: var(--border-color);
        text-decoration: none;
    }
</style>
