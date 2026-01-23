const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameState = document.getElementById('gameState');
const reasoning = document.getElementById('reasoning');
const action = document.getElementById('action');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const stepBtn = document.getElementById('stepBtn');

let ws = null;
let running = false;

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        setTimeout(connect, 2000);
    };
}

function handleMessage(data) {
    if (data.type === 'started') {
        running = true;
        updateButtons();
        return;
    }

    // Update screenshot
    if (data.screenshot) {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = 'data:image/png;base64,' + data.screenshot;
    }

    // Update game state
    if (data.state) {
        const s = data.state;
        gameState.innerHTML = `
            <p><strong>Location:</strong> ${s.location}</p>
            <p><strong>Coordinates:</strong> (${s.coordinates[0]}, ${s.coordinates[1]})</p>
            <p><strong>Money:</strong> $${s.money}</p>
            <p><strong>Badges:</strong> ${s.badges.length > 0 ? s.badges.join(', ') : 'None'}</p>
            <p><strong>Party:</strong></p>
            ${s.party.map(p => `<p style="margin-left:10px">${p}</p>`).join('')}
        `;
    }

    // Update reasoning
    if (data.reasoning) {
        reasoning.textContent = data.reasoning;
    }

    // Update action
    if (data.action) {
        action.textContent = data.action.join(', ');
    }
}

function updateButtons() {
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    stepBtn.disabled = !running;
}

startBtn.onclick = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'start' }));
    }
};

stopBtn.onclick = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop' }));
        running = false;
        updateButtons();
    }
};

stepBtn.onclick = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'step' }));
    }
};

// Connect on page load
connect();
