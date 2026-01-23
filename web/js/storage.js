// storage.js - localStorage save/load
const SAVE_KEY = 'tesserack-save';
const SETTINGS_KEY = 'tesserack-settings';

export function saveState(emulator) {
    try {
        const state = emulator.saveState();
        const encoded = btoa(String.fromCharCode(...state));
        localStorage.setItem(SAVE_KEY, encoded);
        return true;
    } catch (err) {
        console.error('Save failed:', err);
        return false;
    }
}

export function loadState(emulator) {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (!saved) return false;

        const bytes = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
        emulator.loadState(bytes);
        return true;
    } catch (err) {
        console.error('Load failed:', err);
        return false;
    }
}

export function hasSavedState() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : {};
}
