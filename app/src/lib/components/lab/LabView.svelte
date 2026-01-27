<script>
    import { onMount, onDestroy } from 'svelte';
    import { Map, Target, Zap, Settings, Play, Pause, RotateCcw, FlaskConical, Save, FolderOpen, SkipForward, Circle, Square, FastForward, StepForward, Brain } from 'lucide-svelte';
    import WalkthroughGraph from './WalkthroughGraph.svelte';
    import ExperimentRunner from './ExperimentRunner.svelte';
    import LabCanvas from './LabCanvas.svelte';
    import {
        walkthroughGraph,
        currentGraphLocation,
        nextGraphLocation,
        completedObjectives,
        selectedNode,
        labConfig,
        labMetrics,
        graphStats,
        completionPercentage,
        loadWalkthroughGraph,
        resetMetrics
    } from '$lib/stores/lab';
    import { startLabAgent, stopLabAgent, resetLab, getLabInstances, setLabSpeed, stepLabAgent, setLabMode, labMode, pureRLMetrics } from '$lib/core/lab/lab-init.js';
    import { feedSystem } from '$lib/stores/feed';

    let graphComponent;
    let isRunning = false;
    let showConfig = false;
    let showExperiments = false;
    let labInitialized = false;

    // Pure RL mode - no LLM calls, deterministic rewards only
    $: isPureRLMode = $labMode === 'purerl';

    // Playback controls
    let playbackSpeed = 1;
    const speeds = [1, 2, 4, 8];

    // Save states
    let savedStates = [];
    let showSaveStates = false;

    // Recording
    let isRecording = false;
    let recordings = [];

    // LLM Instructions visibility (expanded by default)
    let showLLMInstructions = true;

    // System prompt (from rl-agent.js)
    const SYSTEM_PROMPT = `You are playing Pokemon Red. Generate action sequences to make PROGRESS.

CONTROLS: up, down, left, right, a, b
- Movement: up/down/left/right to walk
- 'a': confirm, talk, interact, advance text
- 'b': cancel, exit menus

CRITICAL RULES:
1. If showing dialog/text: press 'a' 2-3 times to advance, then MOVE
2. If in a building: navigate to exit (usually down then through door)
3. If outdoors: move toward your next objective location
4. VARIETY IS KEY: each plan must have DIFFERENT movement directions
5. Always include movement (up/down/left/right), don't just spam 'a'

OUTPUT FORMAT:
PLAN1: <what you're trying to do>
ACTIONS1: btn1, btn2, btn3, btn4, btn5, btn6, btn7, btn8, btn9, btn10
...`;

    // Map interior game locations to their parent walkthrough location
    const locationToParent = {
        // Pallet Town
        'PLAYERS HOUSE 1F': 'Pallet Town',
        'PLAYERS HOUSE 2F': 'Pallet Town',
        'RIVALS HOUSE': 'Pallet Town',
        'OAKS LAB': 'Pallet Town',
        "PROF. OAK'S LAB": 'Pallet Town',
        'PROF OAKS LAB': 'Pallet Town',
        'PALLET TOWN': 'Pallet Town',
        // Route 1
        'ROUTE 1': 'Route 1',
        // Viridian City
        'VIRIDIAN CITY': 'Viridian City',
        'VIRIDIAN POKEMON CENTER': 'Viridian City',
        'VIRIDIAN POKEMART': 'Viridian City',
        'VIRIDIAN GYM': 'Viridian City',
        // Viridian Forest / Route 2
        'VIRIDIAN FOREST': 'Viridian Forest',
        'ROUTE 2': 'Route 2',
        // Pewter City
        'PEWTER CITY': 'Pewter City',
        'PEWTER POKEMON CENTER': 'Pewter City',
        'PEWTER POKEMART': 'Pewter City',
        'PEWTER GYM': 'Pewter City',
        'PEWTER MUSEUM': 'Pewter City',
        // Mt Moon / Route 3-4
        'ROUTE 3': 'Route 3',
        'MT MOON 1F': 'Mt. Moon',
        'MT MOON B1F': 'Mt. Moon',
        'MT MOON B2F': 'Mt. Moon',
        'ROUTE 4': 'Route 4',
        // Cerulean City
        'CERULEAN CITY': 'Cerulean City',
        'CERULEAN POKEMON CENTER': 'Cerulean City',
        'CERULEAN POKEMART': 'Cerulean City',
        'CERULEAN GYM': 'Cerulean City',
        'CERULEAN BIKE SHOP': 'Cerulean City',
        // Routes around Cerulean
        'ROUTE 24': 'Route 24',
        'ROUTE 25': 'Route 25',
        'ROUTE 5': 'Route 5',
        'ROUTE 6': 'Route 6',
        // Vermilion City
        'VERMILION CITY': 'Vermilion City',
        'VERMILION POKEMON CENTER': 'Vermilion City',
        'VERMILION POKEMART': 'Vermilion City',
        'VERMILION GYM': 'Vermilion City',
        'SS ANNE': 'Vermilion City',
        'S.S. ANNE': 'Vermilion City',
        // Celadon
        'CELADON CITY': 'Celadon City',
        'CELADON GYM': 'Celadon City',
        'CELADON DEPT STORE': 'Celadon City',
        'GAME CORNER': 'Celadon City',
        'ROCKET HIDEOUT': 'Celadon City',
        // Lavender
        'LAVENDER TOWN': 'Lavender Town',
        'POKEMON TOWER': 'Pokemon Tower',
        // Saffron
        'SAFFRON CITY': 'Saffron City',
        'SAFFRON GYM': 'Saffron City',
        'SILPH CO': 'Saffron City',
        // Fuchsia
        'FUCHSIA CITY': 'Fuchsia City',
        'FUCHSIA GYM': 'Fuchsia City',
        'SAFARI ZONE': 'Safari Zone',
        // Cinnabar
        'CINNABAR ISLAND': 'Cinnabar Island',
        'CINNABAR GYM': 'Cinnabar Island',
        'POKEMON MANSION': 'Cinnabar Island',
        // Victory Road / Pokemon League
        'VICTORY ROAD': 'Victory Road',
        'INDIGO PLATEAU': 'Indigo Plateau',
        'POKEMON LEAGUE': 'Indigo Plateau',
    };

    function mapGameLocationToParent(locationName) {
        if (!locationName) return null;
        const upper = locationName.toUpperCase();

        // Direct match
        if (locationToParent[upper]) {
            return locationToParent[upper];
        }

        // Partial match - check if location contains a known key
        for (const [key, parent] of Object.entries(locationToParent)) {
            if (upper.includes(key) || key.includes(upper)) {
                return parent;
            }
        }

        // Try to extract city/town name from location
        const cityMatch = locationName.match(/(PALLET|VIRIDIAN|PEWTER|CERULEAN|VERMILION|CELADON|SAFFRON|LAVENDER|FUCHSIA|CINNABAR)/i);
        if (cityMatch) {
            const cityName = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
            return `${cityName} ${locationName.toLowerCase().includes('town') ? 'Town' : 'City'}`;
        }

        // Return original if no mapping
        return locationName;
    }

    // Build guide context for display (mirrors guide-agent.js logic)
    $: guideContext = buildGuideContextDisplay($currentGraphLocation, $walkthroughGraph, $completedObjectives);

    function buildGuideContextDisplay(locationName, graph, completed) {
        if (!graph?.nodes?.length || !locationName) return null;

        // Map game location to parent walkthrough location
        const mappedLocation = mapGameLocationToParent(locationName);

        // Try exact match first
        let location = graph.nodes.find(n =>
            n.type === 'location' &&
            n.name.toLowerCase() === mappedLocation?.toLowerCase()
        );

        // Fallback: partial match
        if (!location && mappedLocation) {
            location = graph.nodes.find(n =>
                n.type === 'location' &&
                (n.name.toLowerCase().includes(mappedLocation.toLowerCase()) ||
                 mappedLocation.toLowerCase().includes(n.name.toLowerCase()))
            );
        }

        if (!location) return null;

        const context = {
            location: location.name,
            description: location.description || '',
            objectives: [],
            items: [],
            connections: [],
            trainers: []
        };

        for (const edge of graph.edges) {
            if (edge.from !== location.id) continue;

            const target = graph.nodes.find(n => n.id === edge.to);
            if (!target) continue;

            switch (edge.type) {
                case 'contains':
                    if (target.type === 'objective' && !completed.has(target.name)) {
                        context.objectives.push(target);
                    } else if (target.type === 'item') {
                        context.items.push(target);
                    }
                    break;
                case 'leads_to':
                    context.connections.push({ ...target, method: edge.method });
                    break;
                case 'has_trainer':
                    context.trainers.push(target);
                    break;
            }
        }

        return context;
    }

    // Build preview of full prompt sent to LLM
    function buildFullPromptPreview(location, guide) {
        const lines = [];

        // Guide context (if available)
        if (guide) {
            lines.push(`[STRATEGY GUIDE - ${guide.location}]`);
            if (guide.description) {
                lines.push(guide.description);
            }
            if (guide.objectives?.length > 0) {
                lines.push('\nObjectives here:');
                guide.objectives.slice(0, 2).forEach(o => {
                    lines.push(`- ${o.name}`);
                });
            }
            lines.push('');
        }

        // Current situation
        lines.push('=== CURRENT SITUATION ===');
        lines.push(`Location: ${location || 'Unknown'}`);
        lines.push('Position: (x, y)');

        // Add action hint based on location
        const locUpper = (location || '').toUpperCase();
        if (locUpper.includes('HOUSE') && locUpper.includes('2F')) {
            lines.push('ACTION NEEDED: Go downstairs - walk DOWN');
        } else if (locUpper.includes('HOUSE')) {
            lines.push('ACTION NEEDED: Exit house - walk DOWN to door');
        } else {
            lines.push('ACTION NEEDED: Navigate toward objective');
        }

        lines.push('');
        lines.push('=== OBJECTIVE ===');
        lines.push('[From curriculum tracker]');
        lines.push(`Progress: ${$completionPercentage}% | Badges: 0/8`);
        lines.push('');
        lines.push('Generate 3 action plans with DIFFERENT directions:');

        return lines.join('\n');
    }

    onMount(async () => {
        await loadWalkthroughGraph();
        // Load saved states from localStorage
        try {
            const stored = localStorage.getItem('tesserack_lab_states');
            if (stored) savedStates = JSON.parse(stored);
        } catch (e) {}
        // Load recordings
        try {
            const stored = localStorage.getItem('tesserack_lab_recordings');
            if (stored) recordings = JSON.parse(stored);
        } catch (e) {}
    });

    onDestroy(() => {
        if (isRunning) {
            stopLabAgent();
        }
    });

    function handleNodeClick(node) {
        selectedNode.set(node);
    }

    function handleLabInitialized(event) {
        labInitialized = true;
        feedSystem('Lab agent ready. Graph shows your journey through the strategy guide.');
    }

    function toggleRun() {
        if (!labInitialized) {
            feedSystem('Please wait for Lab to initialize...');
            return;
        }

        isRunning = !isRunning;

        if (isRunning) {
            startLabAgent();
            feedSystem('Lab agent started - following strategy guide...');
        } else {
            stopLabAgent();
            feedSystem('Lab agent paused.');
        }
    }

    function handleReset() {
        stopLabAgent();
        resetLab();
        resetMetrics();
        isRunning = false;
        isRecording = false;
        feedSystem('Lab reset. Ready for a new run.');
    }

    function fitGraph() {
        if (graphComponent) {
            graphComponent.fitGraph();
        }
    }

    function centerOnCurrent() {
        if (graphComponent && $currentGraphLocation) {
            graphComponent.centerOnNode($currentGraphLocation);
        }
    }

    // Speed control
    function cycleSpeed() {
        const currentIndex = speeds.indexOf(playbackSpeed);
        playbackSpeed = speeds[(currentIndex + 1) % speeds.length];
        setLabSpeed(playbackSpeed);
        feedSystem(`Playback speed: ${playbackSpeed}x`);
    }

    function stepOnce() {
        if (!labInitialized) return;
        stepLabAgent();
        feedSystem('Stepped one frame');
    }

    // Save/Load states
    // Convert Uint8Array to base64 for JSON storage
    function uint8ArrayToBase64(uint8Array) {
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
    }

    // Convert base64 back to Uint8Array
    function base64ToUint8Array(base64) {
        const binary = atob(base64);
        const uint8Array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            uint8Array[i] = binary.charCodeAt(i);
        }
        return uint8Array;
    }

    async function saveState() {
        if (!labInitialized) {
            feedSystem('Lab not initialized yet');
            return;
        }
        const { emulator } = getLabInstances();
        if (!emulator) {
            feedSystem('Emulator not available');
            return;
        }

        try {
            const state = emulator.saveState(); // Returns Uint8Array
            const newState = {
                id: Date.now(),
                name: `State ${savedStates.length + 1}`,
                timestamp: new Date().toISOString(),
                location: $currentGraphLocation,
                metrics: { ...$labMetrics },
                data: uint8ArrayToBase64(state) // Store as base64 string
            };
            savedStates = [...savedStates, newState];
            localStorage.setItem('tesserack_lab_states', JSON.stringify(savedStates));
            feedSystem(`Saved state: ${newState.name}`);
        } catch (e) {
            console.error('[Lab] Save state error:', e);
            feedSystem(`Failed to save state: ${e.message}`);
        }
    }

    async function loadState(state) {
        if (!labInitialized) {
            feedSystem('Lab not initialized yet');
            return;
        }
        const { emulator } = getLabInstances();
        if (!emulator) {
            feedSystem('Emulator not available');
            return;
        }

        try {
            const stateData = base64ToUint8Array(state.data); // Convert back to Uint8Array
            emulator.loadState(stateData);
            feedSystem(`Loaded state: ${state.name}`);
            showSaveStates = false;
        } catch (e) {
            console.error('[Lab] Load state error:', e);
            feedSystem(`Failed to load state: ${e.message}`);
        }
    }

    function deleteState(state) {
        savedStates = savedStates.filter(s => s.id !== state.id);
        localStorage.setItem('tesserack_lab_states', JSON.stringify(savedStates));
    }

    // Recording
    function toggleRecording() {
        isRecording = !isRecording;
        if (isRecording) {
            feedSystem('Recording started');
            // TODO: Start recording actions
        } else {
            feedSystem('Recording stopped');
            // TODO: Save recording
        }
    }

    function togglePureRLMode() {
        if (isRunning) {
            stopLabAgent();
            isRunning = false;
        }
        setLabMode(isPureRLMode ? 'llm' : 'purerl');
    }

    // Format reward with sign
    function formatReward(r) {
        if (r > 0) return '+' + r.toFixed(3);
        if (r < 0) return r.toFixed(3);
        return '0.000';
    }

    // Get reward class for styling
    function rewardClass(r) {
        if (r > 0) return 'positive';
        if (r < 0) return 'negative';
        return 'neutral';
    }
</script>

<div class="lab-view">
    <!-- Header -->
    <div class="lab-header">
        <div class="lab-title">
            <Map size={20} />
            <span>Lab Mode</span>
            <span class="badge">Strategy Guide</span>
        </div>

        <div class="lab-controls">
            <button class="control-btn" on:click={fitGraph} title="Fit graph">
                <RotateCcw size={16} />
            </button>
            <button class="control-btn" on:click={centerOnCurrent} title="Center on current">
                <Target size={16} />
            </button>
            <button class="control-btn" on:click={() => showConfig = !showConfig} title="Settings">
                <Settings size={16} />
            </button>
            <button class="control-btn" class:active={showExperiments} on:click={() => showExperiments = !showExperiments} title="Experiments">
                <FlaskConical size={16} />
            </button>
            <button class="control-btn" class:active={isPureRLMode} on:click={togglePureRLMode} title="Pure RL Mode - No LLM calls, deterministic rewards only">
                <Brain size={16} />
                <span>Pure RL</span>
            </button>
            <button class="control-btn primary" on:click={toggleRun}>
                {#if isRunning}
                    <Pause size={16} />
                    <span>Pause</span>
                {:else}
                    <Play size={16} />
                    <span>Run</span>
                {/if}
            </button>
        </div>
    </div>

    <!-- Main Content Row: Map + Game -->
    <div class="main-row">
        <!-- Map Area (60%) -->
        <div class="graph-area">
            <WalkthroughGraph
                bind:this={graphComponent}
                graphData={$walkthroughGraph}
                currentLocation={$currentGraphLocation}
                nextLocation={$nextGraphLocation}
                completedObjectives={$completedObjectives}
                onNodeClick={handleNodeClick}
            />

            <!-- Graph Legend -->
            <div class="graph-legend">
                <div class="legend-item">
                    <span class="legend-dot location"></span>
                    <span>Location</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot current"></span>
                    <span>Current</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot next"></span>
                    <span>Next</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot completed"></span>
                    <span>Completed</span>
                </div>
            </div>
        </div>

        <!-- Game Section (40%) -->
        <div class="game-section">
            <!-- Local emulator -->
            <div class="game-preview">
                <LabCanvas on:initialized={handleLabInitialized} />
            </div>

            <!-- Pure RL Metrics Panel (shown when in Pure RL mode) -->
            {#if isPureRLMode}
                <div class="rl-metrics-panel">
                    <div class="rl-metric-row">
                        <span class="rl-label">Step</span>
                        <span class="rl-value">{$pureRLMetrics.step.toLocaleString()}</span>
                    </div>
                    <div class="rl-metric-row">
                        <span class="rl-label">Action</span>
                        <span class="rl-value action">{$pureRLMetrics.action || '-'}</span>
                    </div>
                    <div class="rl-metric-row">
                        <span class="rl-label">Epsilon</span>
                        <span class="rl-value">{($pureRLMetrics.epsilon * 100).toFixed(1)}%</span>
                    </div>
                    <div class="rl-divider"></div>
                    <div class="rl-metric-row">
                        <span class="rl-label">Step Reward</span>
                        <span class="rl-value {rewardClass($pureRLMetrics.reward)}">{formatReward($pureRLMetrics.reward)}</span>
                    </div>
                    <div class="rl-metric-row">
                        <span class="rl-label">Total Reward</span>
                        <span class="rl-value {rewardClass($pureRLMetrics.totalReward)}">{formatReward($pureRLMetrics.totalReward)}</span>
                    </div>
                    <div class="rl-divider"></div>
                    <div class="rl-tier-grid">
                        <div class="rl-tier" class:active={$pureRLMetrics.breakdown.tier1 > 0}>
                            <span class="tier-label">T1</span>
                            <span class="tier-value">{$pureRLMetrics.breakdown.tier1.toFixed(2)}</span>
                            <span class="tier-desc">Move</span>
                        </div>
                        <div class="rl-tier" class:active={$pureRLMetrics.breakdown.tier2 > 0}>
                            <span class="tier-label">T2</span>
                            <span class="tier-value">{$pureRLMetrics.breakdown.tier2.toFixed(2)}</span>
                            <span class="tier-desc">Map</span>
                        </div>
                        <div class="rl-tier" class:active={$pureRLMetrics.breakdown.tier3 > 0}>
                            <span class="tier-label">T3</span>
                            <span class="tier-value">{$pureRLMetrics.breakdown.tier3.toFixed(2)}</span>
                            <span class="tier-desc">Goal</span>
                        </div>
                        <div class="rl-tier penalty" class:active={$pureRLMetrics.breakdown.penalties < -0.02}>
                            <span class="tier-label">Pen</span>
                            <span class="tier-value">{$pureRLMetrics.breakdown.penalties.toFixed(2)}</span>
                            <span class="tier-desc">Stuck</span>
                        </div>
                    </div>
                    {#if $pureRLMetrics.firedTests.length > 0}
                        <div class="rl-fired">
                            {#each $pureRLMetrics.firedTests as test}
                                <span class="fired-tag">{test}</span>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Playback Controls -->
            <div class="playback-controls">
                <button class="pb-btn" on:click={toggleRun} title={isRunning ? 'Pause the AI agent' : 'Start the AI agent following the strategy guide'}>
                    {#if isRunning}
                        <Pause size={20} strokeWidth={2.5} />
                    {:else}
                        <Play size={20} strokeWidth={2.5} />
                    {/if}
                </button>
                <button class="pb-btn" on:click={stepOnce} title="Step one frame - watch AI decisions in slow motion" disabled={isRunning}>
                    <SkipForward size={20} strokeWidth={2.5} />
                </button>
                <button class="pb-btn speed" on:click={cycleSpeed} title="Playback speed - faster for testing, slower for debugging">
                    <FastForward size={20} strokeWidth={2.5} />
                    <span>{playbackSpeed}x</span>
                </button>
                <div class="pb-divider"></div>
                <button class="pb-btn" on:click={saveState} title="Save current game state - restore later to compare different approaches">
                    <Save size={20} strokeWidth={2.5} />
                </button>
                <button class="pb-btn" on:click={() => showSaveStates = !showSaveStates} title="Load a previously saved state" class:active={showSaveStates}>
                    <FolderOpen size={20} strokeWidth={2.5} />
                </button>
                <div class="pb-divider"></div>
                <button class="pb-btn" class:recording={isRecording} on:click={toggleRecording} title={isRecording ? 'Stop recording' : 'Record AI actions for analysis'}>
                    {#if isRecording}
                        <Square size={20} strokeWidth={2.5} />
                    {:else}
                        <Circle size={20} strokeWidth={2.5} />
                    {/if}
                </button>
                <button class="pb-btn" on:click={handleReset} title="Reset - clear metrics and start fresh">
                    <RotateCcw size={20} strokeWidth={2.5} />
                </button>
            </div>

            <!-- Save States Dropdown -->
            {#if showSaveStates && savedStates.length > 0}
                <div class="states-dropdown">
                    {#each savedStates as state}
                        <div class="state-item">
                            <button class="state-load" on:click={() => loadState(state)}>
                                <span class="state-name">{state.name}</span>
                                <span class="state-location">{state.location}</span>
                            </button>
                            <button class="state-delete" on:click={() => deleteState(state)}>×</button>
                        </div>
                    {/each}
                </div>
            {:else if showSaveStates}
                <div class="states-dropdown empty">
                    No saved states yet
                </div>
            {/if}
        </div>
    </div>

    <!-- Agent Pipeline Control Panel (hidden in Pure RL mode) -->
    {#if !isPureRLMode}
    <div class="pipeline-panel">
        <div class="pipeline-header">
            <h3>Agent Pipeline</h3>
            <div class="pipeline-stats">
                <span title="Total actions taken">Steps: <strong>{$labMetrics.totalSteps}</strong></span>
                <span title="Guide objectives completed">Objectives: <strong>{$labMetrics.objectivesCompleted}/{$graphStats.objectives}</strong></span>
                <span title="Overall completion">Progress: <strong>{$completionPercentage}%</strong></span>
                <span title="Cumulative reward signal">Reward: <strong>{$labMetrics.episodeReward.toFixed(1)}</strong></span>
            </div>
        </div>

        <div class="pipeline-nodes">
            <!-- Knowledge Base -->
            <div class="pipeline-card" title="Strategy guide data the AI references">
                <div class="card-header">
                    <div class="card-icon kb"><Map size={18} /></div>
                    <span class="card-title">Knowledge Base</span>
                </div>
                <div class="card-stats">
                    <div class="stat-row">
                        <span>Locations</span>
                        <strong>{$graphStats.locations}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Objectives</span>
                        <strong>{$graphStats.objectives}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Current</span>
                        <strong class="current-location">{$currentGraphLocation || 'N/A'}</strong>
                    </div>
                </div>
            </div>

            <div class="pipeline-arrow">→</div>

            <!-- LLM Planner -->
            <div class="pipeline-card" title="Asks the AI model what to do next">
                <div class="card-header">
                    <div class="card-icon llm"><Zap size={18} /></div>
                    <span class="card-title">LLM Planner</span>
                </div>
                <div class="card-control">
                    <label>
                        <span>Query every</span>
                        <select bind:value={$labConfig.llmQueryFrequency} on:change={() => labConfig.update(c => c)}>
                            <option value={1}>1 step</option>
                            <option value={5}>5 steps</option>
                            <option value={10}>10 steps</option>
                            <option value={25}>25 steps</option>
                            <option value={50}>50 steps</option>
                        </select>
                    </label>
                </div>
                <div class="card-stats">
                    <div class="stat-row">
                        <span>Calls</span>
                        <strong>{$labMetrics.llmCalls}</strong>
                    </div>
                </div>
            </div>

            <div class="pipeline-arrow">→</div>

            <!-- RL Selector -->
            <div class="pipeline-card" title="Picks actions based on learned behavior and exploration">
                <div class="card-header">
                    <div class="card-icon rl"><Target size={18} /></div>
                    <span class="card-title">RL Selector</span>
                </div>
                <div class="card-control">
                    <label>
                        <span>Exploration</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={$labConfig.explorationRate * 100}
                            on:input={(e) => labConfig.update(c => ({...c, explorationRate: e.target.value / 100}))}
                        />
                        <span class="range-value">{($labConfig.explorationRate * 100).toFixed(0)}%</span>
                    </label>
                </div>
                <div class="card-control">
                    <label>
                        <span>Guide Weight</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={$labConfig.guideAdherenceWeight * 100}
                            on:input={(e) => labConfig.update(c => ({...c, guideAdherenceWeight: e.target.value / 100}))}
                        />
                        <span class="range-value">{($labConfig.guideAdherenceWeight * 100).toFixed(0)}%</span>
                    </label>
                </div>
            </div>
        </div>
    </div>
    {/if}

    <!-- LLM Instructions Panel (hidden in Pure RL mode) -->
    {#if !isPureRLMode}
    <div class="llm-instructions-panel">
        <button class="instructions-header" on:click={() => showLLMInstructions = !showLLMInstructions}>
            <span>LLM Instructions</span>
            <span class="toggle-indicator">{showLLMInstructions ? '▼' : '▶'}</span>
        </button>

        {#if showLLMInstructions}
            <div class="instructions-content">
                <div class="instruction-section">
                    <h4>System Prompt</h4>
                    <pre class="prompt-text">{SYSTEM_PROMPT}</pre>
                </div>

                <div class="instruction-section">
                    <h4>Current Guide Context</h4>
                    {#if guideContext}
                        <div class="guide-context">
                            <div class="context-header">[STRATEGY GUIDE - {guideContext.location}]</div>
                            {#if guideContext.description}
                                <p class="context-desc">{guideContext.description}</p>
                            {/if}

                            {#if guideContext.objectives.length > 0}
                                <div class="context-section">
                                    <strong>Objectives here:</strong>
                                    <ul>
                                        {#each guideContext.objectives.slice(0, 3) as obj}
                                            <li>{obj.name}{obj.description ? `: ${obj.description}` : ''}</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}

                            {#if guideContext.items.length > 0}
                                <div class="context-section">
                                    <strong>Items to find:</strong>
                                    <ul>
                                        {#each guideContext.items.slice(0, 3) as item}
                                            <li>{item.name}</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}

                            {#if guideContext.trainers.length > 0}
                                <div class="context-section">
                                    <strong>Trainers:</strong>
                                    <ul>
                                        {#each guideContext.trainers as trainer}
                                            <li>{trainer.name}{trainer.badge ? ` (${trainer.badge})` : ''}</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}

                            {#if guideContext.connections.length > 0}
                                <div class="context-section">
                                    <strong>Connected to:</strong>
                                    <ul>
                                        {#each guideContext.connections.slice(0, 4) as conn}
                                            <li>{conn.name}</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <p class="no-context">No guide context available for current location</p>
                    {/if}
                </div>

                <div class="instruction-section">
                    <h4>User Message (sent with each query)</h4>
                    <div class="prompt-note">
                        The guide context above + game state below are combined into each LLM query:
                    </div>
                    <pre class="prompt-text">{buildFullPromptPreview($currentGraphLocation, guideContext)}</pre>
                </div>
            </div>
        {/if}
    </div>
    {/if}

    <!-- Selected Node Detail -->
    {#if $selectedNode}
        <div class="node-detail panel">
            <div class="detail-header">
                <span class="detail-type">{$selectedNode.type}</span>
                <span class="detail-name">{$selectedNode.label || $selectedNode.name}</span>
            </div>
            {#if $selectedNode.description}
                <p class="detail-desc">{$selectedNode.description}</p>
            {/if}
            {#if $selectedNode.badge}
                <p class="detail-badge">Badge: {$selectedNode.badge}</p>
            {/if}
            <button class="close-btn" on:click={() => selectedNode.set(null)}>×</button>
        </div>
    {/if}

    <!-- Config Panel -->
    {#if showConfig}
        <div class="config-panel panel">
            <h3>Configuration</h3>

            <div class="config-group">
                <label for="llm-query-freq">LLM Query Frequency</label>
                <input id="llm-query-freq" type="range" min="1" max="50" bind:value={$labConfig.llmQueryFrequency} />
                <span>{$labConfig.llmQueryFrequency} steps</span>
            </div>

            <div class="config-group">
                <label for="exploration-rate">Exploration Rate</label>
                <input id="exploration-rate" type="range" min="0" max="100" bind:value={$labConfig.explorationRate}
                    on:input={(e) => labConfig.update(c => ({...c, explorationRate: e.target.value / 100}))} />
                <span>{($labConfig.explorationRate * 100).toFixed(0)}%</span>
            </div>

            <div class="config-group">
                <label for="guide-adherence">Guide Adherence Weight</label>
                <input id="guide-adherence" type="range" min="0" max="100" bind:value={$labConfig.guideAdherenceWeight}
                    on:input={(e) => labConfig.update(c => ({...c, guideAdherenceWeight: e.target.value / 100}))} />
                <span>{($labConfig.guideAdherenceWeight * 100).toFixed(0)}%</span>
            </div>

            <button class="config-close" on:click={() => showConfig = false}>Done</button>
        </div>
    {/if}

    <!-- Experiment Runner Panel -->
    {#if showExperiments}
        <div class="experiment-panel">
            <ExperimentRunner />
        </div>
    {/if}
</div>

<style>
    .experiment-panel {
        position: absolute;
        top: 80px;
        right: 20px;
        width: 340px;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
    }
    .lab-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 12px;
    }

    .lab-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--bg-panel);
        border-radius: 8px;
    }

    .lab-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: var(--text-primary);
    }

    .badge {
        padding: 2px 8px;
        background: var(--accent-primary);
        color: white;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
    }

    .lab-controls {
        display: flex;
        gap: 8px;
    }

    .control-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: var(--bg-input);
        border: none;
        border-radius: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s;
    }

    .control-btn:hover {
        background: var(--bg-input);
        color: var(--text-primary);
    }

    .control-btn.active {
        background: var(--accent-secondary);
        color: white;
    }

    .control-btn.primary {
        background: var(--accent-primary);
        color: white;
    }

    .control-btn.primary:hover {
        filter: brightness(1.1);
    }

    .main-row {
        display: flex;
        gap: 12px;
        flex: 1;
        min-height: 400px;
    }

    .graph-area {
        flex: 6;
        position: relative;
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
    }

    .graph-legend {
        position: absolute;
        bottom: 12px;
        left: 12px;
        display: flex;
        gap: 16px;
        padding: 8px 12px;
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 11px;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-muted);
    }

    .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .legend-dot.location { background: #74b9ff; }
    .legend-dot.current { background: #00ff88; }
    .legend-dot.next { background: #fdcb6e; }
    .legend-dot.completed { background: #00b894; }

    .game-section {
        flex: 4;
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
        background: var(--bg-panel);
        border-radius: 8px;
        padding: 12px;
    }

    .game-preview {
        flex: 1;
        min-height: 200px;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid var(--border-color);
    }

    .playback-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px;
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 6px;
    }

    .pb-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 40px;
        height: 40px;
        padding: 8px;
        background: var(--bg-panel);
        border: 2px solid var(--border-color);
        border-radius: 6px;
        color: #2d3436;
        cursor: pointer;
        transition: all 0.15s;
        overflow: visible;
    }

    :global([data-theme="dark"]) .pb-btn {
        color: #fafaf9;
    }

    .pb-btn:hover:not(:disabled) {
        background: var(--accent-primary);
        color: white;
        border-color: var(--accent-primary);
    }

    .pb-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .pb-btn.active {
        background: var(--accent-primary);
        color: white;
    }

    .pb-btn.speed {
        width: auto;
        padding: 0 8px;
        font-size: 11px;
        font-weight: 600;
    }

    .pb-btn.recording {
        color: #d63031;
        animation: pulse 1s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .pb-divider {
        width: 1px;
        height: 20px;
        background: var(--border-color);
        margin: 0 4px;
    }

    .states-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        width: 180px;
        max-height: 200px;
        overflow-y: auto;
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 100;
    }

    .states-dropdown.empty {
        padding: 12px;
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
    }

    .state-item {
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--border-color);
    }

    .state-item:last-child {
        border-bottom: none;
    }

    .state-load {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 8px 10px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-primary);
    }

    .state-load:hover {
        background: var(--bg-input);
    }

    .state-name {
        font-size: 12px;
        font-weight: 500;
    }

    .state-location {
        font-size: 10px;
        color: var(--text-muted);
    }

    .state-delete {
        padding: 8px;
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 16px;
    }

    .state-delete:hover {
        color: #d63031;
    }

    /* Pipeline Control Panel */
    .pipeline-panel {
        background: var(--bg-panel);
        border-radius: 8px;
        padding: 16px;
    }

    .pipeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .pipeline-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
    }

    .pipeline-stats {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--text-secondary);
    }

    .pipeline-stats strong {
        color: var(--text-primary);
    }

    .pipeline-nodes {
        display: flex;
        align-items: stretch;
        gap: 12px;
    }

    .pipeline-card {
        flex: 1;
        background: var(--bg-input);
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .card-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
    }

    .card-icon.kb { background: rgba(116, 185, 255, 0.2); color: #74b9ff; }
    .card-icon.llm { background: rgba(253, 203, 110, 0.2); color: #fdcb6e; }
    .card-icon.rl { background: rgba(0, 206, 201, 0.2); color: #00cec9; }

    .card-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
    }

    .card-stats {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .stat-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
    }

    .stat-row span {
        color: var(--text-muted);
    }

    .stat-row strong {
        color: var(--text-secondary);
    }

    .stat-row .current-location {
        color: var(--accent-primary);
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .card-control {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .card-control label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--text-muted);
    }

    .card-control select {
        padding: 4px 8px;
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        font-size: 11px;
        color: var(--text-primary);
        cursor: pointer;
    }

    .card-control input[type="range"] {
        flex: 1;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--border-color);
        border-radius: 2px;
        cursor: pointer;
    }

    .card-control input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        background: var(--accent-primary);
        border-radius: 50%;
        cursor: pointer;
    }

    .range-value {
        min-width: 32px;
        text-align: right;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .pipeline-arrow {
        display: flex;
        align-items: center;
        color: var(--text-muted);
        font-size: 20px;
        padding: 0 4px;
    }

    .node-detail {
        position: absolute;
        top: 80px;
        right: 20px;
        width: 280px;
        padding: 16px;
    }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .detail-type {
        padding: 2px 8px;
        background: var(--accent-secondary);
        color: white;
        border-radius: 4px;
        font-size: 10px;
        text-transform: uppercase;
    }

    .detail-name {
        font-weight: 600;
        color: var(--text-primary);
    }

    .detail-desc {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .detail-badge {
        margin-top: 8px;
        font-size: 12px;
        color: var(--accent-primary);
    }

    .close-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 18px;
    }

    .config-panel {
        position: absolute;
        top: 80px;
        left: 20px;
        width: 300px;
        padding: 16px;
    }

    .config-panel h3 {
        margin: 0 0 16px 0;
        color: var(--text-primary);
    }

    .config-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 16px;
    }

    .config-group label {
        font-size: 12px;
        color: var(--text-secondary);
    }

    .config-group input[type="range"] {
        width: 100%;
    }

    .config-group span {
        font-size: 11px;
        color: var(--text-muted);
        text-align: right;
    }

    .config-close {
        width: 100%;
        padding: 8px;
        background: var(--accent-primary);
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
    }

    /* LLM Instructions Panel */
    .llm-instructions-panel {
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
    }

    .instructions-header {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: none;
        border: none;
        color: var(--text-primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
    }

    .instructions-header:hover {
        background: var(--bg-input);
    }

    .toggle-indicator {
        font-size: 10px;
        color: var(--text-muted);
    }

    .instructions-content {
        padding: 0 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .instruction-section {
        background: var(--bg-input);
        border-radius: 6px;
        padding: 12px;
    }

    .instruction-section h4 {
        margin: 0 0 8px 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .prompt-text {
        margin: 0;
        padding: 10px;
        background: var(--bg-panel);
        border-radius: 4px;
        font-size: 11px;
        font-family: 'Monaco', 'Menlo', monospace;
        color: var(--text-secondary);
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 200px;
        overflow-y: auto;
        line-height: 1.5;
    }

    .guide-context {
        font-size: 12px;
        color: var(--text-secondary);
    }

    .context-header {
        font-weight: 600;
        color: #fdcb6e;
        margin-bottom: 8px;
    }

    .context-desc {
        margin: 0 0 8px 0;
        color: var(--text-muted);
        font-style: italic;
    }

    .context-section {
        margin-top: 8px;
    }

    .context-section strong {
        color: var(--text-primary);
        font-size: 11px;
    }

    .context-section ul {
        margin: 4px 0 0 0;
        padding-left: 16px;
    }

    .context-section li {
        margin: 2px 0;
        color: var(--text-muted);
    }

    .no-context {
        margin: 0;
        color: var(--text-muted);
        font-style: italic;
        font-size: 12px;
    }

    .prompt-note {
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 8px;
        font-style: italic;
    }

    /* Pure RL Metrics Panel */
    .rl-metrics-panel {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        background: var(--bg-input);
        border-radius: 6px;
        font-size: 11px;
    }

    .rl-metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .rl-label {
        color: var(--text-muted);
    }

    .rl-value {
        font-weight: 600;
        color: var(--text-primary);
    }

    .rl-value.action {
        text-transform: uppercase;
        background: var(--accent-primary);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
    }

    .rl-value.positive {
        color: #00b894;
    }

    .rl-value.negative {
        color: #d63031;
    }

    .rl-divider {
        height: 1px;
        background: var(--border-color);
        margin: 2px 0;
    }

    .rl-tier-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
    }

    .rl-tier {
        padding: 4px;
        background: var(--bg-panel);
        border-radius: 4px;
        text-align: center;
        opacity: 0.5;
    }

    .rl-tier.active {
        opacity: 1;
        background: rgba(0, 184, 148, 0.15);
        border: 1px solid rgba(0, 184, 148, 0.3);
    }

    .rl-tier.penalty.active {
        background: rgba(214, 48, 49, 0.15);
        border: 1px solid rgba(214, 48, 49, 0.3);
    }

    .rl-tier .tier-label {
        display: block;
        font-size: 9px;
        color: var(--text-muted);
        font-weight: 600;
    }

    .rl-tier .tier-value {
        display: block;
        font-size: 12px;
        font-weight: 700;
        color: var(--text-primary);
    }

    .rl-tier .tier-desc {
        display: block;
        font-size: 8px;
        color: var(--text-muted);
    }

    .rl-fired {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
    }

    .fired-tag {
        padding: 2px 6px;
        background: rgba(0, 184, 148, 0.2);
        color: #00b894;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 500;
    }
</style>
