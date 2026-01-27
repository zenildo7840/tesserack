<script>
    import { onMount, onDestroy } from 'svelte';
    import cytoscape from 'cytoscape';
    import dagre from 'cytoscape-dagre';

    export let graphData = { nodes: [], edges: [] };
    export let currentLocation = null;
    export let nextLocation = null;
    export let completedObjectives = new Set();
    export let onNodeClick = null;

    let container;
    let cy = null;
    let resizeObserver = null;

    // Hover state
    let hoverPosition = null;
    let hoverNode = null;
    let showZoomPreview = false;

    // Register dagre layout
    cytoscape.use(dagre);

    // Color scheme
    const colors = {
        location: '#74b9ff',
        objective: '#00cec9',
        item: '#fdcb6e',
        pokemon: '#e17055',
        trainer: '#d63031',
        requirement: '#636e72',
        current: '#00ff88',
        next: '#fdcb6e',      // Orange/yellow for next destination
        completed: '#00b894',
        edge: '#555',
        edgeHighlight: '#74b9ff'
    };

    // Kanto geographic coordinates (normalized 0-1000 for width, 0-600 for height)
    // Based on actual Kanto map layout
    const kantoPositions = {
        // Northwest - Indigo Plateau area
        'Indigo Plateau': { x: 80, y: 50 },
        'Victory Road': { x: 80, y: 120 },
        'Route 23': { x: 80, y: 200 },
        'Route 22': { x: 150, y: 280 },

        // North center - Viridian/Pewter area
        'Viridian City': { x: 150, y: 350 },
        'Viridian Forest': { x: 150, y: 280 },
        'Route 2': { x: 150, y: 220 },
        'Pewter City': { x: 150, y: 150 },
        'Route 3': { x: 250, y: 150 },
        'Mt. Moon': { x: 350, y: 150 },
        'Route 4': { x: 450, y: 150 },

        // Northeast - Cerulean area
        'Cerulean City': { x: 550, y: 150 },
        'Route 24': { x: 550, y: 80 },
        'Route 25': { x: 650, y: 50 },
        'Route 9': { x: 650, y: 150 },
        'Rock Tunnel': { x: 750, y: 150 },
        'Route 10': { x: 750, y: 220 },
        'Power Plant': { x: 850, y: 120 },

        // East - Lavender area
        'Lavender Town': { x: 750, y: 300 },
        'Pokemon Tower': { x: 800, y: 300 },
        'Route 8': { x: 650, y: 300 },
        'Route 12': { x: 750, y: 400 },

        // Center - Saffron/Celadon
        'Saffron City': { x: 550, y: 300 },
        'Route 5': { x: 550, y: 220 },
        'Route 6': { x: 550, y: 380 },
        'Route 7': { x: 450, y: 300 },
        'Celadon City': { x: 350, y: 300 },
        'Route 16': { x: 250, y: 300 },
        'Cycling Road': { x: 200, y: 400 },
        'Route 17': { x: 200, y: 450 },
        'Underground Path': { x: 500, y: 260 },

        // South - Vermilion area
        'Vermilion City': { x: 550, y: 450 },
        'Vermillion City': { x: 550, y: 450 }, // Handle typo
        'Route 11': { x: 650, y: 450 },
        "Diglett's Cave": { x: 250, y: 180 },

        // Southeast - Fuchsia area
        'Route 13': { x: 750, y: 480 },
        'Route 14': { x: 700, y: 520 },
        'Route 15': { x: 600, y: 550 },
        'Fuchsia City': { x: 450, y: 550 },
        'Fuchsia City Gym': { x: 480, y: 550 },
        'Safari Zone': { x: 450, y: 480 },
        'Route 18': { x: 300, y: 500 },

        // Southwest - Pallet/Cinnabar
        'Pallet Town': { x: 150, y: 450 },
        "Prof. Oak's Lab": { x: 180, y: 470 },
        'Route 1': { x: 150, y: 400 },
        'Route 21': { x: 150, y: 520 },
        'Cinnabar Island': { x: 150, y: 580 },
        'Route 20': { x: 300, y: 580 },
        'Route 19': { x: 450, y: 580 },
        'Seafoam Islands': { x: 300, y: 580 }
    };

    // Map interior/specific game locations to their parent map location
    const locationAliases = {
        // Pallet Town interiors
        'PLAYERS HOUSE 1F': 'Pallet Town',
        'PLAYERS HOUSE 2F': 'Pallet Town',
        'RIVALS HOUSE': 'Pallet Town',
        'OAKS LAB': 'Pallet Town',
        "PROF. OAK'S LAB": 'Pallet Town',
        'PROF OAKS LAB': 'Pallet Town',
        // Viridian City
        'VIRIDIAN POKEMON CENTER': 'Viridian City',
        'VIRIDIAN POKEMART': 'Viridian City',
        'VIRIDIAN GYM': 'Viridian City',
        // Pewter City
        'PEWTER POKEMON CENTER': 'Pewter City',
        'PEWTER POKEMART': 'Pewter City',
        'PEWTER GYM': 'Pewter City',
        'PEWTER MUSEUM': 'Pewter City',
        // Cerulean City
        'CERULEAN POKEMON CENTER': 'Cerulean City',
        'CERULEAN POKEMART': 'Cerulean City',
        'CERULEAN GYM': 'Cerulean City',
        'CERULEAN BIKE SHOP': 'Cerulean City',
        // Vermilion City
        'VERMILION POKEMON CENTER': 'Vermilion City',
        'VERMILION POKEMART': 'Vermilion City',
        'VERMILION GYM': 'Vermilion City',
        'SS ANNE': 'Vermilion City',
        'S.S. ANNE': 'Vermilion City',
        // Celadon City
        'CELADON POKEMON CENTER': 'Celadon City',
        'CELADON DEPT STORE': 'Celadon City',
        'CELADON GYM': 'Celadon City',
        'CELADON GAME CORNER': 'Celadon City',
        'ROCKET HIDEOUT': 'Celadon City',
        // Saffron City
        'SAFFRON POKEMON CENTER': 'Saffron City',
        'SAFFRON POKEMART': 'Saffron City',
        'SAFFRON GYM': 'Saffron City',
        'SILPH CO': 'Saffron City',
        'FIGHTING DOJO': 'Saffron City',
        // Lavender Town
        'LAVENDER POKEMON CENTER': 'Lavender Town',
        'LAVENDER POKEMART': 'Lavender Town',
        'POKEMON TOWER 1F': 'Pokemon Tower',
        'POKEMON TOWER 2F': 'Pokemon Tower',
        'POKEMON TOWER 3F': 'Pokemon Tower',
        'POKEMON TOWER 4F': 'Pokemon Tower',
        'POKEMON TOWER 5F': 'Pokemon Tower',
        'POKEMON TOWER 6F': 'Pokemon Tower',
        'POKEMON TOWER 7F': 'Pokemon Tower',
        // Fuchsia City
        'FUCHSIA POKEMON CENTER': 'Fuchsia City',
        'FUCHSIA POKEMART': 'Fuchsia City',
        'FUCHSIA GYM': 'Fuchsia City',
        // Cinnabar Island
        'CINNABAR POKEMON CENTER': 'Cinnabar Island',
        'CINNABAR POKEMART': 'Cinnabar Island',
        'CINNABAR GYM': 'Cinnabar Island',
        'POKEMON MANSION': 'Cinnabar Island',
        'CINNABAR LAB': 'Cinnabar Island',
        // Mt. Moon
        'MT MOON 1F': 'Mt. Moon',
        'MT MOON B1F': 'Mt. Moon',
        'MT MOON B2F': 'Mt. Moon',
        // Rock Tunnel
        'ROCK TUNNEL 1F': 'Rock Tunnel',
        'ROCK TUNNEL B1F': 'Rock Tunnel',
        // Victory Road
        'VICTORY ROAD 1F': 'Victory Road',
        'VICTORY ROAD 2F': 'Victory Road',
        'VICTORY ROAD 3F': 'Victory Road',
        // Indigo Plateau
        'POKEMON LEAGUE': 'Indigo Plateau',
        'LORELEI': 'Indigo Plateau',
        'BRUNO': 'Indigo Plateau',
        'AGATHA': 'Indigo Plateau',
        'LANCE': 'Indigo Plateau',
        'CHAMPION': 'Indigo Plateau',
    };

    /**
     * Map a game location name to a graph node location
     */
    function mapLocationToNode(locationName) {
        if (!locationName) return null;

        const upperName = locationName.toUpperCase();

        // Direct alias match
        if (locationAliases[upperName]) {
            return locationAliases[upperName];
        }

        // Check if the location name contains a known location
        for (const [alias, target] of Object.entries(locationAliases)) {
            if (upperName.includes(alias) || alias.includes(upperName)) {
                return target;
            }
        }

        // Check against kantoPositions keys (case-insensitive)
        for (const key of Object.keys(kantoPositions)) {
            if (key.toUpperCase() === upperName ||
                upperName.includes(key.toUpperCase()) ||
                key.toUpperCase().includes(upperName)) {
                return key;
            }
        }

        return locationName; // Return original if no mapping found
    }

    function getNodePosition(nodeName, nodeType) {
        // For locations, use geographic position
        if (nodeType === 'location' && kantoPositions[nodeName]) {
            return kantoPositions[nodeName];
        }
        return null; // Will use layout for non-positioned nodes
    }

    function buildCytoscapeData(data) {
        const elements = [];

        // Only show locations for cleaner geographic view
        // Objectives and trainers clutter the map
        const visibleTypes = ['location'];
        const visibleNodes = new Set();

        // Build a map of location -> connected objectives for tooltip
        const locationObjectives = new Map();
        for (const edge of data.edges) {
            if (edge.type === 'contains') {
                const objectives = locationObjectives.get(edge.from) || [];
                const targetNode = data.nodes.find(n => n.id === edge.to);
                if (targetNode) objectives.push(targetNode.name);
                locationObjectives.set(edge.from, objectives);
            }
        }

        // Add nodes
        for (const node of data.nodes) {
            if (!visibleTypes.includes(node.type)) continue;

            const pos = getNodePosition(node.name, node.type);
            if (!pos) continue; // Skip locations without positions

            visibleNodes.add(node.id);

            const isCurrentLocation = node.name === currentLocation || node.id === currentLocation;
            const isNextLocation = node.name === nextLocation || node.id === nextLocation;
            const isCompleted = completedObjectives.has(node.name) || completedObjectives.has(node.id);
            const objectives = locationObjectives.get(node.id) || [];

            let bgColor = colors[node.type] || '#999';
            if (isCurrentLocation) bgColor = colors.current;
            else if (isNextLocation) bgColor = colors.next;
            else if (isCompleted) bgColor = colors.completed;

            elements.push({
                data: {
                    id: node.id,
                    label: node.name,
                    type: node.type,
                    description: node.description,
                    objectives: objectives.join(', '),
                    isGymLeader: node.isGymLeader,
                    badge: node.badge,
                    bgColor,
                    borderWidth: isCurrentLocation ? 4 : (isNextLocation ? 3 : (node.isGymLeader ? 3 : 1)),
                    borderColor: isCurrentLocation ? '#fff' : (isNextLocation ? '#fdcb6e' : (node.isGymLeader ? '#d63031' : '#333'))
                },
                position: pos
            });
        }

        // Add edges (only between visible nodes)
        for (const edge of data.edges) {
            if (!visibleNodes.has(edge.from) || !visibleNodes.has(edge.to)) continue;

            // Only show leads_to edges for geographic connections
            if (edge.type !== 'leads_to') continue;

            elements.push({
                data: {
                    id: `${edge.from}-${edge.to}`,
                    source: edge.from,
                    target: edge.to,
                    edgeType: edge.type,
                    method: edge.method
                }
            });
        }

        return elements;
    }

    function initGraph() {
        console.log('[Graph] initGraph called, container:', !!container, 'nodes:', graphData.nodes?.length || 0);
        if (!container || !graphData.nodes?.length) return;

        const elements = buildCytoscapeData(graphData);
        console.log('[Graph] Built', elements.length, 'cytoscape elements');

        cy = cytoscape({
            container,
            elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'background-color': 'data(bgColor)',
                        'border-width': 'data(borderWidth)',
                        'border-color': 'data(borderColor)',
                        'color': '#fff',
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'text-margin-y': 8,
                        'font-size': '9px',
                        'font-weight': '500',
                        'text-wrap': 'wrap',
                        'text-max-width': '70px',
                        'width': 16,
                        'height': 16,
                        'shape': 'ellipse',
                        'text-outline-width': 2,
                        'text-outline-color': '#1a1a2e'
                    }
                },
                {
                    selector: 'node[type="location"]',
                    style: {
                        'width': 20,
                        'height': 20,
                        'font-size': '10px',
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: 'node[type="objective"]',
                    style: {
                        'width': 12,
                        'height': 12,
                        'font-size': '8px'
                    }
                },
                {
                    selector: 'node[type="trainer"]',
                    style: {
                        'width': 18,
                        'height': 18,
                        'shape': 'diamond'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 3,
                        'line-color': colors.edge,
                        'target-arrow-color': colors.edge,
                        'target-arrow-shape': 'none',
                        'curve-style': 'taxi',
                        'taxi-direction': 'horizontal',
                        'opacity': 0.5
                    }
                },
                {
                    selector: 'edge[edgeType="leads_to"]',
                    style: {
                        'width': 4,
                        'line-color': colors.edgeHighlight,
                        'target-arrow-color': colors.edgeHighlight,
                        'opacity': 0.9
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 4,
                        'border-color': '#fff'
                    }
                }
            ],
            layout: {
                name: 'preset', // Use predefined geographic positions
                padding: 30
            },
            minZoom: 0.1,
            maxZoom: 4,
            wheelSensitivity: 0.3
        });

        // Click handler
        cy.on('tap', 'node', (evt) => {
            const node = evt.target.data();
            if (onNodeClick) {
                onNodeClick(node);
            }
        });

        // Hover handlers for zoom preview
        cy.on('mousemove', (evt) => {
            const pos = evt.position;
            hoverPosition = pos;
            showZoomPreview = true;
            updateZoomPreview(pos);
        });

        cy.on('mouseout', () => {
            showZoomPreview = false;
            hoverNode = null;
        });

        cy.on('mouseover', 'node', (evt) => {
            hoverNode = evt.target.data();
        });

        cy.on('mouseout', 'node', () => {
            hoverNode = null;
        });

        // Fit to view
        cy.fit(undefined, 30);
    }

    let previewDebounceTimer = null;
    let lastPreviewPos = null;

    // Find nearby nodes for the hover preview
    let nearbyNodes = [];

    function updateZoomPreview(pos) {
        if (!cy) return;
        lastPreviewPos = pos;

        // Find nodes near the cursor position
        const radius = 100; // in model coordinates
        nearbyNodes = cy.nodes().filter(node => {
            const nodePos = node.position();
            const dx = nodePos.x - pos.x;
            const dy = nodePos.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < radius;
        }).map(node => node.data()).slice(0, 5); // Limit to 5 nearest
    }

    function updateHighlights() {
        if (!cy) return;

        cy.nodes().forEach(node => {
            const data = node.data();
            const isCurrentLocation = data.label === currentLocation || data.id === currentLocation;
            const isNextLocation = data.label === nextLocation || data.id === nextLocation;
            const isCompleted = completedObjectives.has(data.label) || completedObjectives.has(data.id);

            let bgColor = colors[data.type] || '#999';
            if (isCurrentLocation) bgColor = colors.current;
            else if (isNextLocation) bgColor = colors.next;
            else if (isCompleted) bgColor = colors.completed;

            node.data('bgColor', bgColor);
            node.data('borderWidth', isCurrentLocation ? 4 : (isNextLocation ? 3 : (data.isGymLeader ? 3 : 1)));
            node.data('borderColor', isCurrentLocation ? '#fff' : (isNextLocation ? '#fdcb6e' : (data.isGymLeader ? '#d63031' : '#333')));
        });
    }

    export function centerOnNode(nodeName) {
        if (!cy) {
            console.log('[Graph] centerOnNode: cy not initialized');
            return;
        }

        // Map game location to graph node location
        const mappedName = mapLocationToNode(nodeName);
        console.log('[Graph] centerOnNode:', nodeName, '-> mapped to:', mappedName);

        // Try to find by label or id
        let node = cy.nodes().filter(n => n.data('label') === mappedName);
        if (!node.length) {
            node = cy.nodes().filter(n => n.data('id') === mappedName);
        }
        // Also try case-insensitive match
        if (!node.length) {
            node = cy.nodes().filter(n =>
                n.data('label')?.toLowerCase() === mappedName?.toLowerCase()
            );
        }
        // Try original name if mapping didn't work
        if (!node.length && mappedName !== nodeName) {
            node = cy.nodes().filter(n =>
                n.data('label')?.toLowerCase() === nodeName?.toLowerCase()
            );
        }

        console.log('[Graph] centerOnNode: found', node.length, 'nodes');

        if (node.length) {
            cy.animate({
                center: { eles: node },
                zoom: 2,
                duration: 500
            });
        }
    }

    export function fitGraph() {
        if (cy) {
            cy.fit(undefined, 20);
        }
    }

    onMount(() => {
        initGraph();

        // Auto-fit when container resizes
        resizeObserver = new ResizeObserver(() => {
            if (cy) {
                cy.resize();
                cy.fit(undefined, 30);
            }
        });
        if (container) {
            resizeObserver.observe(container);
        }
    });

    onDestroy(() => {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (cy) {
            cy.destroy();
            cy = null;
        }
    });

    // Reinitialize graph when data loads (handles async loading)
    $: if (container && graphData.nodes.length > 0 && !cy) {
        initGraph();
    }

    $: if (cy && currentLocation) {
        updateHighlights();
    }

    $: if (cy && completedObjectives) {
        updateHighlights();
    }

    $: if (cy && nextLocation) {
        updateHighlights();
    }
</script>

<div class="graph-wrapper">
    <div class="graph-container" bind:this={container}></div>

    <!-- Hover Preview Panel -->
    {#if showZoomPreview && (hoverNode || nearbyNodes.length > 0)}
        <div class="hover-preview">
            {#if hoverNode}
                <div class="preview-main">
                    <span class="preview-type" class:location={hoverNode.type === 'location'} class:objective={hoverNode.type === 'objective'} class:trainer={hoverNode.type === 'trainer'}>
                        {hoverNode.type}
                    </span>
                    <span class="preview-label">{hoverNode.label}</span>
                    {#if hoverNode.description}
                        <p class="preview-desc">{hoverNode.description}</p>
                    {/if}
                    {#if hoverNode.objectives}
                        <div class="preview-objectives">
                            <span class="objectives-title">Objectives:</span>
                            <span class="objectives-list">{hoverNode.objectives}</span>
                        </div>
                    {/if}
                    {#if hoverNode.badge}
                        <span class="preview-badge">Badge: {hoverNode.badge}</span>
                    {/if}
                </div>
            {:else if nearbyNodes.length > 0}
                <div class="preview-nearby">
                    <span class="nearby-title">Nearby:</span>
                    {#each nearbyNodes as node}
                        <div class="nearby-item">
                            <span class="nearby-dot" class:location={node.type === 'location'} class:objective={node.type === 'objective'} class:trainer={node.type === 'trainer'}></span>
                            <span class="nearby-name">{node.label}</span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .graph-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .graph-container {
        width: 100%;
        height: 100%;
        min-height: 400px;
        background: var(--bg-dark);
        border-radius: 8px;
        overflow: hidden;
    }

    .hover-preview {
        position: absolute;
        top: 12px;
        right: 12px;
        min-width: 180px;
        max-width: 250px;
        background: var(--bg-panel);
        border: 1px solid var(--border-color, #333);
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        pointer-events: none;
    }

    .preview-main {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .preview-type {
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 3px;
        width: fit-content;
        background: #555;
        color: #fff;
    }

    .preview-type.location { background: #74b9ff; }
    .preview-type.objective { background: #00cec9; }
    .preview-type.trainer { background: #d63031; }

    .preview-label {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
    }

    .preview-desc {
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.4;
        margin: 0;
    }

    .preview-badge {
        font-size: 11px;
        color: #fdcb6e;
        font-weight: 500;
    }

    .preview-objectives {
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px solid var(--border-color);
    }

    .objectives-title {
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
        display: block;
        margin-bottom: 2px;
    }

    .objectives-list {
        font-size: 11px;
        color: #00cec9;
        line-height: 1.4;
    }

    .preview-nearby {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .nearby-title {
        font-size: 10px;
        text-transform: uppercase;
        color: var(--text-muted);
        font-weight: 600;
    }

    .nearby-item {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .nearby-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #555;
    }

    .nearby-dot.location { background: #74b9ff; }
    .nearby-dot.objective { background: #00cec9; }
    .nearby-dot.trainer { background: #d63031; }

    .nearby-name {
        font-size: 12px;
        color: var(--text-secondary);
    }
</style>
