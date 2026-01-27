// Lab mode state store
import { writable, derived } from 'svelte/store';

// Graph data from Prima guide
export const walkthroughGraph = writable({ nodes: [], edges: [] });

// Current agent position on graph
export const currentGraphLocation = writable('Pallet Town');

// Completed objectives (tracked by name)
export const completedObjectives = writable(new Set());

// Selected node for detail view
export const selectedNode = writable(null);

// Lab mode configuration
export const labConfig = writable({
    // LLM settings
    llmQueryFrequency: 10,      // Steps between LLM calls
    llmContextSize: 2000,       // Max chars of guide context

    // RL settings
    explorationRate: 0.2,       // Epsilon for exploration
    guideAdherenceWeight: 0.5,  // Weight for guide-following reward

    // Experiment settings
    runName: 'default',
    autoSaveMetrics: true
});

// Live metrics during run
export const labMetrics = writable({
    totalSteps: 0,
    llmCalls: 0,
    objectivesCompleted: 0,
    guideAdherenceScore: 0,
    currentReward: 0,
    episodeReward: 0
});

// Experiment history
export const experimentRuns = writable([]);

// Load walkthrough graph
export async function loadWalkthroughGraph() {
    try {
        console.log('[Lab] Loading walkthrough graph...');
        const response = await fetch('/data/walkthrough-graph.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`[Lab] Loaded graph: ${data.nodes?.length || 0} nodes, ${data.edges?.length || 0} edges`);
        walkthroughGraph.set(data);
        return data;
    } catch (e) {
        console.error('[Lab] Failed to load walkthrough graph:', e);
        return null;
    }
}

// Mark objective as completed
export function completeObjective(objectiveName) {
    completedObjectives.update(set => {
        const newSet = new Set(set);
        newSet.add(objectiveName);
        return newSet;
    });

    labMetrics.update(m => ({
        ...m,
        objectivesCompleted: m.objectivesCompleted + 1
    }));
}

// Update current location
export function updateLocation(locationName) {
    currentGraphLocation.set(locationName);
}

// Increment step counter
export function recordStep(reward = 0) {
    labMetrics.update(m => ({
        ...m,
        totalSteps: m.totalSteps + 1,
        currentReward: reward,
        episodeReward: m.episodeReward + reward
    }));
}

// Record LLM call
export function recordLLMCall() {
    labMetrics.update(m => ({
        ...m,
        llmCalls: m.llmCalls + 1
    }));
}

// Reset metrics for new run
export function resetMetrics() {
    labMetrics.set({
        totalSteps: 0,
        llmCalls: 0,
        objectivesCompleted: 0,
        guideAdherenceScore: 0,
        currentReward: 0,
        episodeReward: 0
    });
    completedObjectives.set(new Set());
    currentGraphLocation.set('Pallet Town');
}

// Save current run to history
export function saveExperimentRun(name) {
    let metrics;
    labMetrics.subscribe(m => metrics = m)();

    let config;
    labConfig.subscribe(c => config = c)();

    let completed;
    completedObjectives.subscribe(c => completed = c)();

    const run = {
        name,
        timestamp: Date.now(),
        config: { ...config },
        metrics: { ...metrics },
        completedObjectives: [...completed]
    };

    experimentRuns.update(runs => [...runs, run]);

    // Persist to localStorage
    try {
        const stored = JSON.parse(localStorage.getItem('tesserack_experiments') || '[]');
        stored.push(run);
        localStorage.setItem('tesserack_experiments', JSON.stringify(stored));
    } catch (e) {
        console.error('Failed to save experiment:', e);
    }

    return run;
}

// Load experiments from localStorage
export function loadExperimentHistory() {
    try {
        const stored = JSON.parse(localStorage.getItem('tesserack_experiments') || '[]');
        experimentRuns.set(stored);
        return stored;
    } catch (e) {
        console.error('Failed to load experiments:', e);
        return [];
    }
}

// Derived: graph statistics
export const graphStats = derived(walkthroughGraph, $graph => ({
    locations: $graph.nodes.filter(n => n.type === 'location').length,
    objectives: $graph.nodes.filter(n => n.type === 'objective').length,
    items: $graph.nodes.filter(n => n.type === 'item').length,
    pokemon: $graph.nodes.filter(n => n.type === 'pokemon').length,
    edges: $graph.edges.length
}));

// Derived: completion percentage
export const completionPercentage = derived(
    [walkthroughGraph, completedObjectives],
    ([$graph, $completed]) => {
        const totalObjectives = $graph.nodes.filter(n => n.type === 'objective').length;
        if (totalObjectives === 0) return 0;
        return Math.round(($completed.size / totalObjectives) * 100);
    }
);

// Derived: next graph location (first unvisited location reachable from current)
export const nextGraphLocation = derived(
    [walkthroughGraph, currentGraphLocation, completedObjectives],
    ([$graph, $current, $completed]) => {
        if (!$graph.edges?.length || !$current) return null;

        // Find the current location node
        const currentNode = $graph.nodes.find(n =>
            n.name === $current || n.id === $current
        );
        if (!currentNode) return null;

        // Find edges leading FROM current location
        const outgoingEdges = $graph.edges.filter(e =>
            e.from === currentNode.id && e.type === 'leads_to'
        );

        // Find the first destination that isn't completed
        for (const edge of outgoingEdges) {
            const destNode = $graph.nodes.find(n => n.id === edge.to);
            if (destNode && !$completed.has(destNode.name) && !$completed.has(destNode.id)) {
                return destNode.name;
            }
        }

        // If all immediate destinations are completed, return the first anyway
        if (outgoingEdges.length > 0) {
            const firstDest = $graph.nodes.find(n => n.id === outgoingEdges[0].to);
            if (firstDest) return firstDest.name;
        }

        return null;
    }
);
