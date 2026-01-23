// agent.js - Game agent that coordinates LLM and emulator
import { generate } from './llm.js';
import { parseResponse } from './action-parser.js';

const SYSTEM_PROMPT = `You are an AI playing Pokemon Red. Goal: become Pokemon Champion.

Given the game state, output your next 10 button presses.

RULES:
- Valid buttons: up, down, left, right, a, b, start, select
- Press 'a' to talk, confirm, or advance dialog
- Press 'b' to cancel or go back
- Use directions to move on the map
- In battle: select moves with up/down, confirm with 'a'

OUTPUT FORMAT (follow exactly):
PLAN: <brief 1-line goal>
ACTIONS: button1, button2, button3, button4, button5, button6, button7, button8, button9, button10

Example:
PLAN: Walk right to exit room and talk to NPC
ACTIONS: right, right, right, up, up, a, a, a, a, a

Now analyze and respond:`;

export class GameAgent {
    constructor(emulator, memoryReader, onUpdate) {
        this.emu = emulator;
        this.reader = memoryReader;
        this.onUpdate = onUpdate;
        this.running = false;
        this.turboMode = false;
        this.manualOverrideUntil = 0;
        this.stepCount = 0;
        this.actionQueue = [];
    }

    buildPrompt(state) {
        const lines = [SYSTEM_PROMPT, '', 'CURRENT GAME STATE:'];

        lines.push(`Location: ${state.location}`);
        lines.push(`Coordinates: (${state.coordinates.x}, ${state.coordinates.y})`);
        lines.push(`Money: $${state.money}`);
        lines.push(`Badges: ${state.badges.length > 0 ? state.badges.join(', ') : 'None'}`);

        lines.push('', 'POKEMON PARTY:');
        for (const p of state.party) {
            lines.push(`  ${p.species} Lv.${p.level} HP:${p.currentHP}/${p.maxHP}`);
        }

        lines.push('', 'PLAN:');

        return lines.join('\n');
    }

    async step() {
        // If we have queued actions, execute one
        if (this.actionQueue.length > 0) {
            const action = this.actionQueue.shift();
            this.emu.pressButton(action);
            this.stepCount++;

            // Autosave every 50 steps
            if (this.stepCount % 50 === 0) {
                import('./storage.js').then(({ saveState }) => {
                    saveState(this.emu);
                    console.log('Autosaved at step', this.stepCount);
                });
            }

            if (this.onUpdate) {
                this.onUpdate({
                    action: [action],
                    reasoning: `Executing queued action ${this.actionQueue.length + 1} remaining`,
                    state: this.reader.getGameState()
                });
            }
            return;
        }

        // Get new actions from LLM
        const state = this.reader.getGameState();
        const prompt = this.buildPrompt(state);

        try {
            const response = await generate(prompt);
            const { plan, actions } = parseResponse(response);

            // Queue all actions
            this.actionQueue = [...actions];

            if (this.onUpdate) {
                this.onUpdate({
                    action: actions,
                    reasoning: plan,
                    state
                });
            }
        } catch (err) {
            console.error('LLM error:', err);
            // Default actions on error
            this.actionQueue = ['a', 'a', 'a'];
        }
    }

    async runLLM() {
        this.running = true;
        this.turboMode = false;

        while (this.running) {
            // Check manual override
            if (Date.now() < this.manualOverrideUntil) {
                await this.sleep(100);
                continue;
            }

            await this.step();
            await this.sleep(100);
        }
    }

    runTurbo() {
        this.running = true;
        this.turboMode = true;

        const loop = () => {
            if (!this.running || !this.turboMode) return;

            this.emu.pressButton('a');
            this.stepCount++;

            // Autosave every 50 steps
            if (this.stepCount % 50 === 0) {
                import('./storage.js').then(({ saveState }) => {
                    saveState(this.emu);
                    console.log('Autosaved at step', this.stepCount);
                });
            }

            if (this.stepCount % 10 === 0 && this.onUpdate) {
                this.onUpdate({
                    action: ['Turbo: a'],
                    reasoning: `Turbo mode - step ${this.stepCount}`,
                    state: this.reader.getGameState()
                });
            }

            setTimeout(loop, 50);
        };

        loop();
    }

    stop() {
        this.running = false;
        this.turboMode = false;
        this.actionQueue = [];
    }

    manualButton(button) {
        this.manualOverrideUntil = Date.now() + 3000;
        this.emu.pressButton(button);

        if (this.onUpdate) {
            this.onUpdate({
                action: [`Manual: ${button}`],
                reasoning: 'Manual control - LLM paused for 3s',
                state: this.reader.getGameState()
            });
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
