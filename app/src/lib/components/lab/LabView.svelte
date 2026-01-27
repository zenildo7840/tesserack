<script>
    import { onMount } from 'svelte';
    import { Map, Target, Zap, Settings, Play, Pause, RotateCcw, FlaskConical } from 'lucide-svelte';
    import WalkthroughGraph from './WalkthroughGraph.svelte';
    import ExperimentRunner from './ExperimentRunner.svelte';
    import {
        walkthroughGraph,
        currentGraphLocation,
        completedObjectives,
        selectedNode,
        labConfig,
        labMetrics,
        graphStats,
        completionPercentage,
        loadWalkthroughGraph,
        resetMetrics
    } from '$lib/stores/lab';

    let graphComponent;
    let isRunning = false;
    let showConfig = false;
    let showExperiments = false;

    onMount(async () => {
        await loadWalkthroughGraph();
    });

    function handleNodeClick(node) {
        selectedNode.set(node);
    }

    function toggleRun() {
        isRunning = !isRunning;
        // TODO: Connect to actual agent
    }

    function handleReset() {
        resetMetrics();
        isRunning = false;
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

    <!-- Main Graph Area -->
    <div class="graph-area">
        <WalkthroughGraph
            bind:this={graphComponent}
            graphData={$walkthroughGraph}
            currentLocation={$currentGraphLocation}
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
                <span class="legend-dot objective"></span>
                <span>Objective</span>
            </div>
            <div class="legend-item">
                <span class="legend-dot trainer"></span>
                <span>Gym Leader</span>
            </div>
            <div class="legend-item">
                <span class="legend-dot current"></span>
                <span>Current</span>
            </div>
            <div class="legend-item">
                <span class="legend-dot completed"></span>
                <span>Completed</span>
            </div>
        </div>
    </div>

    <!-- Bottom Panel -->
    <div class="bottom-panel">
        <!-- Pipeline Nodes -->
        <div class="pipeline">
            <div class="pipeline-node">
                <div class="node-icon kb">
                    <Map size={16} />
                </div>
                <div class="node-info">
                    <span class="node-label">Knowledge Base</span>
                    <span class="node-value">{$graphStats.locations} locations</span>
                </div>
            </div>

            <div class="pipeline-arrow">→</div>

            <div class="pipeline-node">
                <div class="node-icon llm">
                    <Zap size={16} />
                </div>
                <div class="node-info">
                    <span class="node-label">LLM Planner</span>
                    <span class="node-value">{$labMetrics.llmCalls} calls</span>
                </div>
            </div>

            <div class="pipeline-arrow">→</div>

            <div class="pipeline-node">
                <div class="node-icon rl">
                    <Target size={16} />
                </div>
                <div class="node-info">
                    <span class="node-label">RL Selector</span>
                    <span class="node-value">{($labConfig.explorationRate * 100).toFixed(0)}% explore</span>
                </div>
            </div>
        </div>

        <!-- Live Stats -->
        <div class="live-stats">
            <div class="stat">
                <span class="stat-label">Steps</span>
                <span class="stat-value">{$labMetrics.totalSteps}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Objectives</span>
                <span class="stat-value">{$labMetrics.objectivesCompleted}/{$graphStats.objectives}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Progress</span>
                <span class="stat-value">{$completionPercentage}%</span>
            </div>
            <div class="stat">
                <span class="stat-label">Reward</span>
                <span class="stat-value">{$labMetrics.episodeReward.toFixed(1)}</span>
            </div>
        </div>
    </div>

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
                <label>LLM Query Frequency</label>
                <input type="range" min="1" max="50" bind:value={$labConfig.llmQueryFrequency} />
                <span>{$labConfig.llmQueryFrequency} steps</span>
            </div>

            <div class="config-group">
                <label>Exploration Rate</label>
                <input type="range" min="0" max="100" bind:value={$labConfig.explorationRate}
                    on:input={(e) => labConfig.update(c => ({...c, explorationRate: e.target.value / 100}))} />
                <span>{($labConfig.explorationRate * 100).toFixed(0)}%</span>
            </div>

            <div class="config-group">
                <label>Guide Adherence Weight</label>
                <input type="range" min="0" max="100" bind:value={$labConfig.guideAdherenceWeight}
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
        background: var(--bg-card);
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
        background: var(--bg-hover);
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

    .graph-area {
        flex: 1;
        min-height: 400px;
        position: relative;
        background: var(--bg-card);
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
        background: rgba(26, 26, 46, 0.9);
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
    .legend-dot.objective { background: #00cec9; }
    .legend-dot.trainer { background: #d63031; }
    .legend-dot.current { background: #00ff88; }
    .legend-dot.completed { background: #00b894; }

    .bottom-panel {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: var(--bg-card);
        border-radius: 8px;
    }

    .pipeline {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }

    .pipeline-node {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: var(--bg-input);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .pipeline-node:hover {
        background: var(--bg-hover);
    }

    .node-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
    }

    .node-icon.kb { background: rgba(116, 185, 255, 0.2); color: #74b9ff; }
    .node-icon.llm { background: rgba(253, 203, 110, 0.2); color: #fdcb6e; }
    .node-icon.rl { background: rgba(0, 206, 201, 0.2); color: #00cec9; }

    .node-info {
        display: flex;
        flex-direction: column;
    }

    .node-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
    }

    .node-value {
        font-size: 11px;
        color: var(--text-muted);
    }

    .pipeline-arrow {
        color: var(--text-muted);
        font-size: 18px;
    }

    .live-stats {
        display: flex;
        gap: 20px;
        padding-left: 16px;
        border-left: 1px solid var(--border-color);
    }

    .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .stat-label {
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
    }

    .stat-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
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
</style>
