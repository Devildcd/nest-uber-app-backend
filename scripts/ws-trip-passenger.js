const io = require('socket.io-client');

const SERVER = process.env.SERVER || 'http://localhost:3000';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''; // token de un PASSENGER
if (!ACCESS_TOKEN) { console.error('Falta ACCESS_TOKEN (passenger)'); process.exit(1); }

const socket = io(`${SERVER}/passengers`, {
  transports: ['websocket'],
  auth: { token: ACCESS_TOKEN },
  reconnection: false,
});

socket.on('connect', () => console.log('[PAX WS] connected:', socket.id));
socket.on('disconnect', (r) => console.log('[PAX WS] disconnected:', r));
socket.on('connect_error', (e) => console.error('[PAX WS] error:', e?.message || e));

// Evento que mandamos en el listener:
socket.on('trip:requested', (p) => console.log('[EVT] trip:requested', p));