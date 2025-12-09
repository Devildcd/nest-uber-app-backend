const io = require('socket.io-client');

const SERVER = process.env.SERVER || 'http://localhost:3000';
const NAMESPACE = '/admin';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''; // token de un ADMIN/DISPATCHER

if (!ACCESS_TOKEN) {
  console.error('Falta ACCESS_TOKEN (admin). set ACCESS_TOKEN=...');
  process.exit(1);
}

const socket = io(`${SERVER}${NAMESPACE}`, {
  transports: ['websocket'],
  auth: { token: ACCESS_TOKEN },
  reconnection: false,
});

socket.on('connect', () => console.log('[ADMIN WS] connected:', socket.id));
socket.on('disconnect', (r) => console.log('[ADMIN WS] disconnected:', r));
socket.on('connect_error', (e) => console.error('[ADMIN WS] error:', e?.message || e));

// Escucha TODO lo que emite tu publisher hacia admin:drivers
socket.on('driver:availability:update', (p) =>
  console.log('[EVT] driver:availability:update', p),
);
socket.on('driver:location:update', (p) =>
  console.log('[EVT] driver:location:update', p),
);
socket.on('driver:trip:update', (p) =>
  console.log('[EVT] driver:trip:update', p),
);

// (si re-envías auth en /admin)
socket.on('auth:logged_in', (p) => console.log('[EVT] auth:logged_in', p));
socket.on('auth:session_refreshed', (p) => console.log('[EVT] auth:session_refreshed', p));
socket.on('auth:session_revoked', (p) => console.log('[EVT] auth:session_revoked', p));