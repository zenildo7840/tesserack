/**
 * Unit Test Rewards - Deterministic reward evaluation for pure RL mode.
 *
 * Evaluates state transitions against simple tests, returning tiered rewards:
 * - Tier 1: Movement (coordinates changed)
 * - Tier 2: Exploration (map changed)
 * - Tier 3: Milestones (badges, Pokemon caught)
 * - Penalties: Stuck/idle detection
 */

export class UnitTestRewards {
    constructor(config = {}) {
        this.config = {
            // Tier weights
            tier1Weight: config.tier1Weight ?? 1.0,
            tier2Weight: config.tier2Weight ?? 1.0,
            tier3Weight: config.tier3Weight ?? 1.0,
            penaltyWeight: config.penaltyWeight ?? 1.0,

            // Enable/disable tiers
            enableTier1: config.enableTier1 ?? true,
            enableTier2: config.enableTier2 ?? true,
            enableTier3: config.enableTier3 ?? true,
            enablePenalties: config.enablePenalties ?? true,

            // Stuck detection
            stuckThreshold: config.stuckThreshold ?? 30,  // steps without movement
        };

        // Track state for stuck detection
        this.lastPosition = null;
        this.stuckCounter = 0;

        // Track one-time rewards (badges, etc.)
        this.seenBadges = 0;
        this.seenPartyCount = 0;
        this.visitedMaps = new Set();

        // Metrics
        this.totalRewards = {
            tier1: 0,
            tier2: 0,
            tier3: 0,
            penalties: 0,
            total: 0
        };
        this.firedTests = [];
    }

    /**
     * Evaluate rewards for a state transition.
     * @param {Object} prevState - Previous game state
     * @param {Object} currState - Current game state
     * @returns {Object} { total, breakdown: {tier1, tier2, tier3, penalties}, firedTests: [] }
     */
    evaluate(prevState, currState) {
        let tier1 = 0;
        let tier2 = 0;
        let tier3 = 0;
        let penalties = 0;
        const fired = [];

        // === TIER 1: Movement ===
        if (this.config.enableTier1) {
            const moved = this.testCoordsChanged(prevState, currState);
            if (moved) {
                tier1 += 0.1 * this.config.tier1Weight;
                fired.push('coords_changed');
                this.stuckCounter = 0;
            }
        }

        // === TIER 2: Exploration ===
        if (this.config.enableTier2) {
            const mapChanged = this.testMapChanged(prevState, currState);
            if (mapChanged) {
                tier2 += 1.0 * this.config.tier2Weight;
                fired.push('map_changed');
            }

            // Bonus for new map (first visit)
            const newMap = this.testNewMap(currState);
            if (newMap) {
                tier2 += 2.0 * this.config.tier2Weight;
                fired.push('new_map_discovered');
            }
        }

        // === TIER 3: Milestones ===
        if (this.config.enableTier3) {
            const badgeGained = this.testBadgeGained(prevState, currState);
            if (badgeGained) {
                tier3 += 10.0 * this.config.tier3Weight;
                fired.push('badge_gained');
            }

            const pokemonCaught = this.testPokemonCaught(prevState, currState);
            if (pokemonCaught) {
                tier3 += 5.0 * this.config.tier3Weight;
                fired.push('pokemon_caught');
            }

            const levelUp = this.testLevelUp(prevState, currState);
            if (levelUp) {
                tier3 += 1.0 * this.config.tier3Weight;
                fired.push('level_up');
            }
        }

        // === PENALTIES ===
        if (this.config.enablePenalties) {
            // Stuck penalty
            if (!this.testCoordsChanged(prevState, currState)) {
                this.stuckCounter++;
                if (this.stuckCounter >= this.config.stuckThreshold) {
                    penalties -= 0.5 * this.config.penaltyWeight;
                    fired.push('stuck_penalty');
                }
            }

            // Small step cost to encourage efficiency
            penalties -= 0.01 * this.config.penaltyWeight;
        }

        const total = tier1 + tier2 + tier3 + penalties;

        // Update totals
        this.totalRewards.tier1 += tier1;
        this.totalRewards.tier2 += tier2;
        this.totalRewards.tier3 += tier3;
        this.totalRewards.penalties += penalties;
        this.totalRewards.total += total;
        this.firedTests = fired;

        return {
            total,
            breakdown: { tier1, tier2, tier3, penalties },
            firedTests: fired
        };
    }

    // === Individual Tests ===

    testCoordsChanged(prev, curr) {
        if (!prev?.coordinates || !curr?.coordinates) return false;
        return prev.coordinates.x !== curr.coordinates.x ||
               prev.coordinates.y !== curr.coordinates.y;
    }

    testMapChanged(prev, curr) {
        if (!prev?.location || !curr?.location) return false;
        return prev.location !== curr.location;
    }

    testNewMap(curr) {
        if (!curr?.location) return false;
        if (this.visitedMaps.has(curr.location)) return false;
        this.visitedMaps.add(curr.location);
        return true;
    }

    testBadgeGained(prev, curr) {
        const prevBadges = prev?.badgeCount ?? 0;
        const currBadges = curr?.badgeCount ?? 0;
        if (currBadges > prevBadges && currBadges > this.seenBadges) {
            this.seenBadges = currBadges;
            return true;
        }
        return false;
    }

    testPokemonCaught(prev, curr) {
        const prevCount = prev?.party?.length ?? 0;
        const currCount = curr?.party?.length ?? 0;
        if (currCount > prevCount && currCount > this.seenPartyCount) {
            this.seenPartyCount = currCount;
            return true;
        }
        return false;
    }

    testLevelUp(prev, curr) {
        if (!prev?.party || !curr?.party) return false;
        const prevMaxLevel = Math.max(...prev.party.map(p => p.level || 0), 0);
        const currMaxLevel = Math.max(...curr.party.map(p => p.level || 0), 0);
        return currMaxLevel > prevMaxLevel;
    }

    // === Utility ===

    reset() {
        this.stuckCounter = 0;
        this.seenBadges = 0;
        this.seenPartyCount = 0;
        this.visitedMaps.clear();
        this.totalRewards = { tier1: 0, tier2: 0, tier3: 0, penalties: 0, total: 0 };
        this.firedTests = [];
    }

    getStats() {
        return {
            totalRewards: { ...this.totalRewards },
            visitedMaps: this.visitedMaps.size,
            stuckCounter: this.stuckCounter
        };
    }
}

export default UnitTestRewards;
