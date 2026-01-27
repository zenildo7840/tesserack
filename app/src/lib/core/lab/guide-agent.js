/**
 * Guide-Enhanced Agent
 *
 * Extends the RL agent to use Prima Strategy Guide as knowledge base.
 * Injects guide context into LLM prompts and adds guide adherence rewards.
 */

import { RLAgent } from '../rl-agent.js';
import {
    walkthroughGraph,
    currentGraphLocation,
    completedObjectives,
    labMetrics,
    labConfig,
    completeObjective,
    updateLocation,
    recordStep,
    recordLLMCall
} from '../../stores/lab.js';
import { get } from 'svelte/store';

/**
 * Build guide context string for current game state
 */
function buildGuideContext(locationName, graph) {
    if (!graph || !graph.nodes.length) return '';

    // Find location node
    const location = graph.nodes.find(n =>
        n.type === 'location' &&
        n.name.toLowerCase().includes(locationName.toLowerCase())
    );

    if (!location) return '';

    const lines = [];
    lines.push(`[STRATEGY GUIDE - ${location.name}]`);

    if (location.description) {
        lines.push(location.description);
    }

    // Find objectives at this location
    const objectives = [];
    const items = [];
    const connections = [];
    const trainers = [];

    for (const edge of graph.edges) {
        if (edge.from !== location.id) continue;

        const target = graph.nodes.find(n => n.id === edge.to);
        if (!target) continue;

        switch (edge.type) {
            case 'contains':
                if (target.type === 'objective') objectives.push(target);
                else if (target.type === 'item') items.push(target);
                break;
            case 'leads_to':
                connections.push({ ...target, method: edge.method });
                break;
            case 'has_trainer':
                trainers.push(target);
                break;
        }
    }

    // Get completed objectives to filter
    const completed = get(completedObjectives);

    const pendingObjectives = objectives.filter(o => !completed.has(o.name));
    if (pendingObjectives.length > 0) {
        lines.push('\nObjectives here:');
        for (const obj of pendingObjectives.slice(0, 3)) {
            lines.push(`- ${obj.name}${obj.description ? ': ' + obj.description : ''}`);
        }
    }

    if (items.length > 0) {
        lines.push('\nItems to find:');
        for (const item of items.slice(0, 3)) {
            lines.push(`- ${item.name}`);
        }
    }

    if (trainers.length > 0) {
        lines.push('\nTrainers:');
        for (const trainer of trainers) {
            const badge = trainer.badge ? ` (${trainer.badge})` : '';
            lines.push(`- ${trainer.name}${badge}`);
        }
    }

    if (connections.length > 0) {
        lines.push('\nConnected to:');
        for (const conn of connections.slice(0, 4)) {
            lines.push(`- ${conn.name}`);
        }
    }

    return lines.join('\n');
}

/**
 * Check if any objectives were completed based on state change
 */
function checkObjectiveCompletions(prevState, currentState, graph) {
    const completions = [];
    const completed = get(completedObjectives);

    // Check badge objectives
    const badgeMap = {
        'BOULDER': ['brock', 'boulder badge'],
        'CASCADE': ['misty', 'cascade badge'],
        'THUNDER': ['lt. surge', 'thunder badge'],
        'RAINBOW': ['erika', 'rainbow badge'],
        'SOUL': ['koga', 'soul badge'],
        'MARSH': ['sabrina', 'marsh badge'],
        'VOLCANO': ['blaine', 'volcano badge'],
        'EARTH': ['giovanni', 'earth badge']
    };

    for (const [badge, keywords] of Object.entries(badgeMap)) {
        const hadBadge = prevState.badges?.includes(badge);
        const hasBadge = currentState.badges?.includes(badge);

        if (hasBadge && !hadBadge) {
            // Find matching objective
            const objective = graph.nodes.find(n =>
                n.type === 'objective' &&
                keywords.some(kw => n.name.toLowerCase().includes(kw))
            );
            if (objective && !completed.has(objective.name)) {
                completions.push(objective.name);
            }
        }
    }

    // Check Pokemon objectives
    if (currentState.party?.length > 0 && prevState.party?.length === 0) {
        const starterObj = graph.nodes.find(n =>
            n.type === 'objective' &&
            n.name.toLowerCase().includes('choose') &&
            n.name.toLowerCase().includes('pokemon')
        );
        if (starterObj && !completed.has(starterObj.name)) {
            completions.push(starterObj.name);
        }
    }

    // Check location-based objectives (reaching new areas)
    if (currentState.location !== prevState.location) {
        const reachObjectives = graph.nodes.filter(n =>
            n.type === 'objective' &&
            (n.name.toLowerCase().includes('reach') || n.name.toLowerCase().includes('get to'))
        );

        for (const obj of reachObjectives) {
            if (completed.has(obj.name)) continue;

            // Check if objective location matches current location
            const targetLocation = obj.name
                .replace(/reach|get to/gi, '')
                .trim()
                .toLowerCase();

            if (currentState.location.toLowerCase().includes(targetLocation)) {
                completions.push(obj.name);
            }
        }
    }

    return completions;
}

/**
 * Calculate guide adherence reward
 * Rewards the agent for following the strategy guide's recommendations
 */
function calculateGuideAdherenceReward(prevState, currentState, graph) {
    let reward = 0;
    const config = get(labConfig);
    const weight = config.guideAdherenceWeight;

    // Reward for completing guide objectives
    const completions = checkObjectiveCompletions(prevState, currentState, graph);
    reward += completions.length * 10 * weight;

    // Reward for moving toward guide-recommended locations
    if (currentState.location !== prevState.location) {
        const currentLoc = graph.nodes.find(n =>
            n.type === 'location' &&
            n.name.toLowerCase().includes(currentState.location.toLowerCase())
        );

        if (currentLoc) {
            // Check if this location has pending objectives
            const hasObjectives = graph.edges.some(e =>
                e.from === currentLoc.id &&
                e.type === 'contains' &&
                graph.nodes.find(n => n.id === e.to && n.type === 'objective')
            );

            if (hasObjectives) {
                reward += 2 * weight; // Bonus for reaching a location with objectives
            }
        }
    }

    return reward;
}

/**
 * Guide-Enhanced RL Agent
 */
export class GuideAgent extends RLAgent {
    constructor(emulator, memoryReader, onUpdate) {
        super(emulator, memoryReader, onUpdate);

        this.graph = null;
        this.guideContextEnabled = true;
        this.lastState = null;

        // Load graph
        this.loadGraph();
    }

    async loadGraph() {
        try {
            const response = await fetch('/data/walkthrough-graph.json');
            this.graph = await response.json();
            walkthroughGraph.set(this.graph);
        } catch (e) {
            console.error('Failed to load walkthrough graph:', e);
        }
    }

    /**
     * Override buildUserMessage to inject guide context
     */
    buildUserMessage(state) {
        // Get base message from parent
        const baseMessage = super.buildUserMessage(state);

        if (!this.guideContextEnabled || !this.graph) {
            return baseMessage;
        }

        // Build guide context for current location
        const guideContext = buildGuideContext(state.location, this.graph);

        if (!guideContext) {
            return baseMessage;
        }

        // Inject guide context before the game state
        const config = get(labConfig);
        const maxContext = config.llmContextSize || 2000;
        const trimmedContext = guideContext.slice(0, maxContext);

        return `${trimmedContext}\n\n${baseMessage}`;
    }

    /**
     * Override step to track metrics and check objectives
     */
    async step() {
        const prevState = this.lastState || this.reader.getGameState();

        // Call parent step
        await super.step();

        const currentState = this.reader.getGameState();
        this.lastState = currentState;

        // Update location tracking
        if (currentState.location) {
            updateLocation(currentState.location);
        }

        // Check for objective completions
        if (this.graph) {
            const completions = checkObjectiveCompletions(prevState, currentState, this.graph);
            for (const objName of completions) {
                completeObjective(objName);
                console.log(`Guide objective completed: ${objName}`);
            }

            // Calculate guide adherence reward
            const guideReward = calculateGuideAdherenceReward(prevState, currentState, this.graph);
            if (guideReward > 0) {
                // Add to experience buffer with guide reward
                this.addGuideReward(guideReward);
            }
        }

        // Record step in metrics
        recordStep(this.rewardCalc?.lastReward || 0);
    }

    /**
     * Add guide adherence reward to the reward signal
     */
    addGuideReward(reward) {
        // This could be added to the experience buffer or used to modify
        // the current episode's reward. For now, just track it.
        labMetrics.update(m => ({
            ...m,
            guideAdherenceScore: m.guideAdherenceScore + reward
        }));
    }

    /**
     * Override to track LLM calls
     */
    async getLLMResponse(prompt) {
        recordLLMCall();
        return super.getLLMResponse?.(prompt);
    }

    /**
     * Get current guide objective suggestion
     */
    getCurrentGuideObjective() {
        if (!this.graph) return null;

        const location = get(currentGraphLocation);
        const completed = get(completedObjectives);

        // Find objectives at current location
        const locNode = this.graph.nodes.find(n =>
            n.type === 'location' &&
            n.name.toLowerCase().includes(location.toLowerCase())
        );

        if (!locNode) return null;

        for (const edge of this.graph.edges) {
            if (edge.from !== locNode.id || edge.type !== 'contains') continue;

            const obj = this.graph.nodes.find(n => n.id === edge.to && n.type === 'objective');
            if (obj && !completed.has(obj.name)) {
                return obj;
            }
        }

        return null;
    }

    /**
     * Toggle guide context in prompts
     */
    setGuideContextEnabled(enabled) {
        this.guideContextEnabled = enabled;
    }
}

/**
 * Create a guide-enhanced agent instance
 */
export function createGuideAgent(emulator, memoryReader, onUpdate) {
    return new GuideAgent(emulator, memoryReader, onUpdate);
}
