<script>
    import { romLoaded, romBuffer } from '$lib/stores/game';
    import { feedSystem } from '$lib/stores/feed';
    import { Upload } from 'lucide-svelte';

    let dragging = false;
    let fileInput;

    async function handleFile(file) {
        if (!file) return;

        feedSystem(`Loading ${file.name}...`);

        try {
            const buffer = await file.arrayBuffer();
            console.log('ROM loaded:', buffer.byteLength, 'bytes');

            // Store the buffer - GameCanvas will handle initialization
            romBuffer.set(buffer);
            romLoaded.set(true);

        } catch (err) {
            feedSystem(`Error: ${err.message}`);
            console.error('Failed to load ROM:', err);
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        dragging = false;
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }

    function handleDragOver(e) {
        e.preventDefault();
        dragging = true;
    }

    function handleDragLeave() {
        dragging = false;
    }

    function handleClick() {
        fileInput.click();
    }

    function handleInputChange(e) {
        const file = e.target.files[0];
        handleFile(file);
    }
</script>

<div
    class="dropzone"
    class:dragging
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:click={handleClick}
    role="button"
    tabindex="0"
    on:keypress={(e) => e.key === 'Enter' && handleClick()}
>
    <div class="dropzone-content">
        <div class="icon">
            <Upload size={40} strokeWidth={1.5} />
        </div>
        <p class="title">Drop Pokemon Red ROM</p>
        <p class="subtitle">or click to select file</p>
        <p class="format">.gb, .gbc</p>
    </div>

    <input
        type="file"
        accept=".gb,.gbc"
        bind:this={fileInput}
        on:change={handleInputChange}
        hidden
    />
</div>

<style>
    .dropzone {
        width: 100%;
        aspect-ratio: 160 / 144;
        background: var(--bg-panel);
        border: 2px dashed var(--text-muted);
        border-radius: var(--border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .dropzone:hover,
    .dropzone.dragging {
        border-color: var(--accent-primary);
        background: rgba(116, 185, 255, 0.08);
    }

    .dropzone-content {
        text-align: center;
    }

    .icon {
        color: var(--text-muted);
        margin-bottom: 16px;
    }

    .dropzone:hover .icon,
    .dropzone.dragging .icon {
        color: var(--accent-primary);
    }

    .format {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 8px;
        font-family: monospace;
    }

    .title {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 4px;
    }

    .subtitle {
        font-size: 13px;
        color: var(--text-secondary);
    }
</style>
