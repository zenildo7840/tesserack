<script>
    import { onMount } from 'svelte';
    import { modelState } from '$lib/stores/training';
    import { romLoaded, romBuffer } from '$lib/stores/game';
    import { llmState, tokenStats, PROVIDERS, setProvider, setModel, setApiKey } from '$lib/stores/llm';
    import { theme } from '$lib/stores/theme';
    import { feedSystem } from '$lib/stores/feed';
    import { hasROM, loadROM, saveROM } from '$lib/core/persistence.js';
    import { startIntroSkip } from '$lib/core/game-init.js';
    import { testConnection } from '$lib/core/llm.js';
    import { Cpu, CheckCircle, Info, Github, ChevronDown, ChevronUp, X, Zap, Sun, Moon, Upload, PlayCircle, FastForward, Settings, AlertCircle, Check, RefreshCw } from 'lucide-svelte';

    let aboutOpen = false;
    let romDropdownOpen = false;
    let modelDropdownOpen = false;
    let fileInput;
    let hasSavedROM = false;
    let skipIntro = true;

    // Model config state
    let apiKey = '';
    let showApiKey = false;
    let testing = false;
    let testResult = null;
    let testError = '';

    $: hasTokenStats = $tokenStats.requestCount > 0;
    $: provider = PROVIDERS[$llmState.provider] || PROVIDERS.browser;
    $: isBrowser = $llmState.provider === 'browser';
    $: needsApiKey = provider.needsKey && !$llmState.apiKey;

    // Build timestamp injected by Vite
    const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;

    onMount(() => {
        hasSavedROM = hasROM();
        apiKey = $llmState.apiKey || '';
    });

    // Sync apiKey when provider changes
    $: apiKey = $llmState.apiKey || '';

    function formatBuildTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
    }

    // ROM functions
    async function handleFile(file, shouldSkipIntro = false) {
        if (!file) return;
        feedSystem(`Loading ${file.name}...`);
        try {
            const buffer = await file.arrayBuffer();
            await saveROM(buffer);
            romBuffer.set(buffer);
            romLoaded.set(true);
            romDropdownOpen = false;
            if (shouldSkipIntro) {
                setTimeout(() => startIntroSkip(), 500);
            }
        } catch (err) {
            feedSystem(`Error: ${err.message}`);
        }
    }

    function loadSavedROM(shouldSkipIntro = false) {
        feedSystem('Loading saved ROM...');
        try {
            const buffer = loadROM();
            if (buffer) {
                romBuffer.set(buffer);
                romLoaded.set(true);
                romDropdownOpen = false;
                feedSystem('ROM loaded from previous session');
                if (shouldSkipIntro) {
                    setTimeout(() => startIntroSkip(), 500);
                }
            } else {
                feedSystem('No saved ROM found');
                hasSavedROM = false;
            }
        } catch (err) {
            feedSystem(`Error: ${err.message}`);
            hasSavedROM = false;
        }
    }

    function handleInputChange(e) {
        const file = e.target.files[0];
        handleFile(file, skipIntro);
    }

    function triggerFileInput() {
        fileInput.click();
    }

    // Model functions
    function handleProviderChange(providerId) {
        setProvider(providerId);
        testResult = null;
        testError = '';
    }

    function handleModelChange(e) {
        setModel(e.target.value);
    }

    function handleApiKeyBlur() {
        setApiKey(apiKey);
        testResult = null;
    }

    async function handleTestConnection() {
        testing = true;
        testResult = null;
        const result = await testConnection(provider.endpoint, apiKey);
        testing = false;
        if (result.success) {
            testResult = 'success';
        } else {
            testResult = 'error';
            testError = result.error || 'Connection failed';
        }
    }

    // Close dropdowns when clicking outside
    function handleClickOutside(e) {
        if (!e.target.closest('.rom-dropdown-container')) {
            romDropdownOpen = false;
        }
        if (!e.target.closest('.model-dropdown-container')) {
            modelDropdownOpen = false;
        }
    }
</script>

<svelte:window on:click={handleClickOutside} />

<header class="header">
    <div class="logo">
        <div class="logo-icon">
            <Cpu size={24} />
        </div>
        <div class="logo-text">
            <h1>Tesserack</h1>
            <div class="subtitle-row">
                <span class="tagline">AI Plays Pokemon</span>
                {#if buildTime}
                    <span class="build-time">{formatBuildTime(buildTime)}</span>
                {/if}
            </div>
        </div>
    </div>

    <div class="header-center">
        <!-- ROM Dropdown -->
        <div class="rom-dropdown-container">
            <button
                class="dropdown-trigger"
                class:active={$romLoaded}
                on:click|stopPropagation={() => romDropdownOpen = !romDropdownOpen}
                title="Load or manage ROM"
            >
                <Upload size={16} />
                <span>{$romLoaded ? 'Pokemon Red' : 'No ROM'}</span>
                <ChevronDown size={14} />
            </button>

            {#if romDropdownOpen}
                <div class="dropdown-panel rom-panel">
                    {#if hasSavedROM && !$romLoaded}
                        <button class="dropdown-item continue" on:click={() => loadSavedROM(skipIntro)}>
                            <PlayCircle size={18} />
                            <div class="item-text">
                                <strong>Continue</strong>
                                <small>Resume previous session</small>
                            </div>
                        </button>
                        <div class="dropdown-divider"></div>
                    {/if}

                    <button class="dropdown-item" on:click={triggerFileInput}>
                        <Upload size={18} />
                        <div class="item-text">
                            <strong>Load ROM</strong>
                            <small>.gb, .gbc files</small>
                        </div>
                    </button>

                    <label class="dropdown-checkbox">
                        <input type="checkbox" bind:checked={skipIntro} />
                        <FastForward size={14} />
                        <span>Quick Start (auto-skip intro)</span>
                    </label>

                    <input
                        type="file"
                        accept=".gb,.gbc"
                        bind:this={fileInput}
                        on:change={handleInputChange}
                        hidden
                    />
                </div>
            {/if}
        </div>

        <!-- Model Dropdown -->
        <div class="model-dropdown-container">
            <button
                class="dropdown-trigger"
                class:warning={needsApiKey}
                on:click|stopPropagation={() => modelDropdownOpen = !modelDropdownOpen}
                title="Configure AI model"
            >
                <Settings size={16} />
                <span>{provider.name}</span>
                {#if needsApiKey}
                    <AlertCircle size={14} class="warning-icon" />
                {:else}
                    <ChevronDown size={14} />
                {/if}
            </button>

            {#if modelDropdownOpen}
                <div class="dropdown-panel model-panel">
                    <div class="panel-section">
                        <label class="section-label">Provider</label>
                        <div class="provider-grid">
                            {#each Object.values(PROVIDERS) as p}
                                <button
                                    class="provider-chip"
                                    class:selected={$llmState.provider === p.id}
                                    on:click={() => handleProviderChange(p.id)}
                                >
                                    {p.name}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="panel-section">
                        <label class="section-label">Model</label>
                        <select value={$llmState.model} on:change={handleModelChange}>
                            {#each provider.models || [] as model}
                                <option value={model.id}>{model.name}</option>
                            {/each}
                        </select>
                    </div>

                    {#if provider.needsKey}
                        <div class="panel-section">
                            <label class="section-label">API Key</label>
                            <div class="api-key-row">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    bind:value={apiKey}
                                    on:blur={handleApiKeyBlur}
                                    placeholder="Enter API key"
                                />
                                <button class="icon-btn" on:click={() => showApiKey = !showApiKey}>
                                    {showApiKey ? '🙈' : '👁️'}
                                </button>
                                <button
                                    class="icon-btn test-btn"
                                    on:click={handleTestConnection}
                                    disabled={testing || !apiKey}
                                    class:spinning={testing}
                                >
                                    {#if testResult === 'success'}
                                        <Check size={14} />
                                    {:else}
                                        <RefreshCw size={14} />
                                    {/if}
                                </button>
                            </div>
                            {#if testResult === 'error'}
                                <div class="test-error">{testError}</div>
                            {/if}
                        </div>
                    {/if}

                    {#if hasTokenStats}
                        <div class="panel-section stats">
                            <span><Zap size={12} /> {$tokenStats.lastTokensPerSecond} tok/s</span>
                            <span>{($tokenStats.totalTokens / 1000).toFixed(1)}k tokens</span>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <div class="header-right">
        <button class="theme-toggle" on:click={theme.toggle} title="Toggle dark mode">
            {#if $theme === 'dark'}
                <Sun size={18} />
            {:else}
                <Moon size={18} />
            {/if}
        </button>

        <button class="about-btn" on:click={() => aboutOpen = !aboutOpen}>
            <Info size={16} />
            <span>About</span>
            {#if aboutOpen}
                <ChevronUp size={14} />
            {:else}
                <ChevronDown size={14} />
            {/if}
        </button>

        {#if $romLoaded && $modelState.hasModel}
            <span class="model-badge trained">
                <CheckCircle size={14} />
                Model v{$modelState.sessions}
            </span>
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

    .subtitle-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .tagline {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .build-time {
        font-size: 10px;
        color: var(--text-muted);
        opacity: 0.7;
        padding-left: 8px;
        border-left: 1px solid var(--border-color);
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

    .theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        background: var(--bg-input);
        color: var(--text-secondary);
        border-radius: 8px;
        transition: all 0.2s;
    }

    .theme-toggle:hover {
        background: var(--bg-dark);
        color: var(--accent-warning);
    }

    /* Header center - dropdowns */
    .header-center {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .rom-dropdown-container,
    .model-dropdown-container {
        position: relative;
    }

    .dropdown-trigger {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-secondary);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
    }

    .dropdown-trigger:hover {
        background: var(--bg-dark);
        color: var(--text-primary);
    }

    .dropdown-trigger.active {
        background: rgba(116, 185, 255, 0.1);
        border-color: var(--accent-primary);
        color: var(--accent-primary);
    }

    .dropdown-trigger.warning {
        border-color: var(--accent-warning);
    }

    .dropdown-trigger :global(.warning-icon) {
        color: var(--accent-warning);
    }

    .dropdown-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        min-width: 280px;
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        box-shadow: var(--shadow-medium);
        padding: 12px;
        z-index: 1000;
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: var(--text-primary);
        cursor: pointer;
        transition: background 0.15s;
        text-align: left;
    }

    .dropdown-item:hover {
        background: var(--bg-input);
    }

    .dropdown-item.continue {
        background: linear-gradient(135deg, var(--accent-primary), #a29bfe);
        color: white;
    }

    .dropdown-item.continue:hover {
        filter: brightness(1.1);
    }

    .dropdown-item :global(svg) {
        flex-shrink: 0;
    }

    .item-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .item-text strong {
        font-size: 14px;
    }

    .item-text small {
        font-size: 11px;
        opacity: 0.7;
    }

    .dropdown-divider {
        height: 1px;
        background: var(--border-color);
        margin: 8px 0;
    }

    .dropdown-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        font-size: 12px;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: 6px;
        margin-top: 4px;
    }

    .dropdown-checkbox:hover {
        background: var(--bg-input);
    }

    .dropdown-checkbox input:checked + :global(svg) {
        color: var(--accent-primary);
    }

    /* Model dropdown specific */
    .model-panel {
        min-width: 320px;
    }

    .panel-section {
        margin-bottom: 12px;
    }

    .panel-section:last-child {
        margin-bottom: 0;
    }

    .section-label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 8px;
    }

    .provider-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .provider-chip {
        padding: 6px 12px;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 12px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s;
    }

    .provider-chip:hover {
        border-color: var(--text-muted);
        color: var(--text-primary);
    }

    .provider-chip.selected {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: white;
    }

    .panel-section select {
        width: 100%;
        padding: 8px 12px;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 13px;
        cursor: pointer;
    }

    .panel-section select:focus {
        outline: none;
        border-color: var(--accent-primary);
    }

    .api-key-row {
        display: flex;
        gap: 6px;
    }

    .api-key-row input {
        flex: 1;
        padding: 8px 12px;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 13px;
    }

    .api-key-row input:focus {
        outline: none;
        border-color: var(--accent-primary);
    }

    .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        flex-shrink: 0;
    }

    .icon-btn:hover:not(:disabled) {
        background: var(--bg-dark);
        color: var(--text-primary);
    }

    .icon-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .icon-btn.test-btn :global(svg) {
        color: var(--accent-success);
    }

    .icon-btn.spinning :global(svg) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .test-error {
        margin-top: 6px;
        padding: 6px 10px;
        background: rgba(255, 107, 107, 0.1);
        border-radius: 4px;
        font-size: 11px;
        color: var(--accent-secondary);
    }

    .panel-section.stats {
        display: flex;
        justify-content: space-between;
        padding-top: 12px;
        border-top: 1px solid var(--border-color);
        font-size: 12px;
        color: var(--text-muted);
    }

    .panel-section.stats span {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .panel-section.stats :global(svg) {
        color: var(--accent-primary);
    }
</style>
