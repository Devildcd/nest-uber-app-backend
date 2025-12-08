const io = require('socket.io-client');

const SERVER = process.env.SERVER || 'http://localhost:3000';
const NAMESPACE = process.env.NAMESPACE || '/drivers';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''; // pega aquí temporalmente si quieres

if (!ACCESS_TOKEN) {
  console.error('Falta ACCESS_TOKEN (exporta ACCESS_TOKEN=... o edita el archivo)');
  process.exit(1);
}

const socket = io(`${SERVER}${NAMESPACE}`, {
  transports: ['websocket'],
  auth: { token: ACCESS_TOKEN },
  reconnection: false,
});

socket.on('connect', () => console.log('[WS] connected:', socket.id));
socket.on('disconnect', (reason) => console.log('[WS] disconnected:', reason));
socket.on('connect_error', (err) => console.error('[WS] connect_error:', err.message));

// Eventos que tu publisher emite:
socket.on('auth:logged_in', (p) => console.log('[WS] auth:logged_in', p));
socket.on('auth:session_refreshed', (p) => console.log('[WS] auth:session_refreshed', p));
socket.on('auth:session_revoked', (p) => console.log('[WS] auth:session_revoked', p));