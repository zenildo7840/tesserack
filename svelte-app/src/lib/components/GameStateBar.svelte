<script>
    import { gameState } from '$lib/stores/game';
    import { MapPin, Users, Award } from 'lucide-svelte';
</script>

<div class="game-state-bar panel">
    <div class="state-item">
        <MapPin size={14} />
        <span class="label">Location</span>
        <span class="value">{$gameState.location || 'Unknown'}</span>
        <span class="coords">({$gameState.coordinates?.x || 0}, {$gameState.coordinates?.y || 0})</span>
    </div>

    <div class="state-item">
        <Users size={14} />
        <span class="label">Party</span>
        <span class="value">
            {#if $gameState.party?.length > 0}
                {$gameState.party.map(p => `${p.species} Lv${p.level}`).join(', ')}
            {:else}
                No Pokemon
            {/if}
        </span>
    </div>

    <div class="state-item">
        <Award size={14} />
        <span class="label">Badges</span>
        <span class="value badge-count">{$gameState.badges?.length || 0}/8</span>
    </div>
</div>

<style>
    .game-state-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        padding: 12px 16px;
        font-size: 12px;
    }

    .state-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-secondary);
    }

    .state-item :global(svg) {
        color: var(--text-muted);
    }

    .label {
        color: var(--text-muted);
    }

    .value {
        color: var(--text-primary);
        font-weight: 500;
    }

    .coords {
        color: var(--text-muted);
        font-size: 11px;
    }

    .badge-count {
        color: var(--accent-primary);
    }
</style>
