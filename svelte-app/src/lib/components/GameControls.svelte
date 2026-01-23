<script>
    import { activeMode } from '$lib/stores/agent';
    import { pressButton, setButton } from '$lib/core/game-init.js';
    import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-svelte';

    function press(button) {
        pressButton(button);
    }

    function hold(button, pressed) {
        setButton(button, pressed);
    }

    // Keyboard controls
    const keyMap = {
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'z': 'a',
        'x': 'b',
        'Enter': 'start',
        'Shift': 'select'
    };

    function handleKeydown(e) {
        if (e.target.tagName === 'INPUT') return;
        const button = keyMap[e.key];
        if (button) {
            press(button);
            e.preventDefault();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="game-controls panel">
    <div class="dpad">
        <button class="dpad-btn up" on:click={() => press('up')}>
            <ChevronUp size={18} />
        </button>
        <div class="dpad-row">
            <button class="dpad-btn left" on:click={() => press('left')}>
                <ChevronLeft size={18} />
            </button>
            <button class="dpad-btn right" on:click={() => press('right')}>
                <ChevronRight size={18} />
            </button>
        </div>
        <button class="dpad-btn down" on:click={() => press('down')}>
            <ChevronDown size={18} />
        </button>
    </div>

    <div class="action-buttons">
        <button class="btn-b" on:click={() => press('b')}>B</button>
        <button class="btn-a" on:click={() => press('a')}>A</button>
    </div>

    <div class="menu-buttons">
        <button class="btn-menu" on:click={() => press('select')}>Sel</button>
        <button class="btn-menu" on:click={() => press('start')}>Start</button>
    </div>
</div>

<style>
    .game-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 16px;
    }

    .dpad {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .dpad-row {
        display: flex;
        gap: 24px;
    }

    .dpad-btn {
        width: 36px;
        height: 36px;
        background: var(--bg-input);
        color: var(--text-secondary);
        border-radius: 6px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border-color);
    }

    .dpad-btn:hover {
        background: var(--border-color);
        color: var(--text-primary);
    }

    .dpad-btn:active {
        background: var(--accent-primary);
        color: white;
    }

    .action-buttons {
        display: flex;
        gap: 12px;
    }

    .btn-a, .btn-b {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        font-weight: 600;
        font-size: 14px;
    }

    .btn-a {
        background: var(--accent-secondary);
        color: white;
    }

    .btn-b {
        background: var(--accent-primary);
        color: white;
    }

    .btn-a:active, .btn-b:active {
        transform: scale(0.95);
    }

    .menu-buttons {
        display: flex;
        gap: 8px;
    }

    .btn-menu {
        padding: 8px 14px;
        background: var(--bg-input);
        color: var(--text-secondary);
        font-size: 11px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
    }

    .btn-menu:hover {
        background: var(--border-color);
        color: var(--text-primary);
    }
</style>
