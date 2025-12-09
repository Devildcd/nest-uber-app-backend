/**
 * Test de flujo WS + HTTP para trips
 *
 * Qué hace:
 *  - Abre 3 sockets: /passengers, /drivers, /admin
 *  - Loguea eventos relevantes:
 *      passenger: trip:requested, trip:assigning_started
 *      driver:    trip:assignment:offered
 *      admin:     trip:requested, trip:assigning_started, trip:assignment:offered
 *  - Dispara POST /trips con el payload esperado por tu backend
 *
 * Requisitos:
 *   npm i axios socket.io-client dotenv
 *
 * Variables de entorno (ejemplo .env):
 *   API_BASE=http://localhost:3000
 *   WS_BASE=http://localhost:3000
 *   PASSENGER_TOKEN=eyJ...
 *   DRIVER_TOKEN=eyJ...
 *   ADMIN_TOKEN=eyJ...         (opcional si tienes gateway de admin)
 *   PASSENGER_ID=<uuid>        (el id del usuario pasajero, usado en el POST)
 *   VEHICLE_CATEGORY_ID=<uuid>
 *   SERVICE_CLASS_ID=<uuid>
 *
 * Ejecutar:
 *   node test-ws-flow.js
 */

process.env.WS_BASE  = process.env.WS_BASE  || 'http://localhost:3000';
process.env.WS_PATH  = process.env.WS_PATH  || '/socket.io'; // opcional si personalizaste el path

// JWTs (los mismos que usas en Postman para cada namespace)
process.env.PASSENGER_TOKEN = process.env.PASSENGER_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MWIyNzIxNS05OWIzLTRmNGQtODQ3ZS04ZmYxZDllYWNmZjkiLCJlbWFpbCI6Implbm55QGdtYWlsLmNvbSIsInBob25lTnVtYmVyIjpudWxsLCJzaWQiOiIyM2E4ZjlkZi1iYmZjLTQwZjMtOTdmNC0xODg3ZGRkYTczMGIiLCJhdWQiOiJwYXNzZW5nZXJfYXBwIiwidXNlclR5cGUiOiJwYXNzZW5nZXIiLCJpYXQiOjE3NjI5NTMyMDcsImV4cCI6MTc2Mjk2MjIwNywiaXNzIjoibmVzdC11YmVyLWFwcC1iYWNrZW5kIn0.ZZu_0HaCfGfr5JomiRn_A-Xnuv13MybGrn9n232GEyk';
process.env.DRIVER_TOKEN    = process.env.DRIVER_TOKEN    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjODUwYzI2MS1mNGY4LTQzN2ItYjRjYS1jZDY1YTM3MjNlOTMiLCJlbWFpbCI6ImRhdmlkQGdtYWlsLmNvbSIsInBob25lTnVtYmVyIjpudWxsLCJzaWQiOiIzMTMyMThkZC1iZTM2LTRhYmQtYTYwNS1hZmVmZGIyYzI5NWIiLCJhdWQiOiJkcml2ZXJfYXBwIiwidXNlclR5cGUiOiJkcml2ZXIiLCJpYXQiOjE3NjI5NTMwOTEsImV4cCI6MTc2Mjk2MjA5MSwiaXNzIjoibmVzdC11YmVyLWFwcC1iYWNrZW5kIn0.Po-KjLysqeJwz0k-uxAEfQjXlfGGuXtINHAoO4Ja2UA';
// process.env.ADMIN_TOKEN  = '...'; // opcional

// --- 2) Deps
const { io } = require('socket.io-client');

// --- 3) Config
const WS_BASE         = process.env.WS_BASE;
const WS_PATH         = process.env.WS_PATH; // <- opcional
const PASSENGER_TOKEN = process.env.PASSENGER_TOKEN;
const DRIVER_TOKEN    = process.env.DRIVER_TOKEN;
const ADMIN_TOKEN     = process.env.ADMIN_TOKEN;

// Namespaces
const NS_PASSENGERS = '/passengers';
const NS_DRIVERS    = '/drivers';
const NS_ADMIN      = '/admin';

// --- 4) Helpers
const t = () => new Date().toISOString();
const logEvt = (label, event, payload) => {
  console.log(`[${t()}] ${label} :: ${event}`);
  console.dir(payload, { depth: 6, colors: true });
  console.log('---');
};

const connectSocket = (baseUrl, namespace, token, label) => {
  if (!token) {
    console.warn(`[WARN] No token for ${label}. Skipping socket connection.`);
    return null;
  }
  const socket = io(baseUrl + namespace, {
    transports: ['websocket'],
    path: WS_PATH, // <- si no personalizaste el path, no pasa nada
    auth: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },
    reconnectionAttempts: 5,
    timeout: 10000,
  });

  socket.on('connect', () => {
  console.log(`[${t()}] ${label} connected: id=${socket.id} nsp=${socket.nsp || '(unknown)'}`);
});

  socket.on('connect_error', (err) => {
    // Muestra más contexto del error si lo hay
    console.error(
      `[${t()}] ${label} connect_error:`,
      err?.message || err,
      err?.data ? ` data=${JSON.stringify(err.data)}` : '',
    );
  });

  socket.on('disconnect', (why) =>
    console.warn(`[${t()}] ${label} disconnected: ${why}`),
  );

  // Escucha el “hello” de handshake que emiten tus gateways
  socket.on('hello', (p) => logEvt(label, 'hello', p));

  return socket;
};

// --- 5) Main (solo escucha)
(async function main() {
  console.log('--- WS LISTENER CONFIG ---');
  console.log({ WS_BASE, WS_PATH, NS_PASSENGERS, NS_DRIVERS, NS_ADMIN });
  console.log('--------------------------\n');

  const sockPassenger = connectSocket(WS_BASE, NS_PASSENGERS, PASSENGER_TOKEN, 'PASSENGER');
  const sockDriver    = connectSocket(WS_BASE, NS_DRIVERS,    DRIVER_TOKEN,    'DRIVER');
  const sockAdmin     = ADMIN_TOKEN ? connectSocket(WS_BASE, NS_ADMIN, ADMIN_TOKEN, 'ADMIN') : null;

  // Pasajero: creación y paso a assigning
  sockPassenger?.on('trip:requested',         (p) => logEvt('PASSENGER', 'trip:requested', p));
  sockPassenger?.on('trip:assigning_started', (p) => logEvt('PASSENGER', 'trip:assigning_started', p));

  // Driver: recepción de una oferta
  sockDriver?.on('trip:assignment:offered',   (p) => logEvt('DRIVER', 'trip:assignment:offered', p));

  // Admin: espejo de eventos
  sockAdmin?.on('trip:requested',             (p) => logEvt('ADMIN', 'trip:requested', p));
  sockAdmin?.on('trip:assigning_started',     (p) => logEvt('ADMIN', 'trip:assigning_started', p));
  sockAdmin?.on('trip:assignment:offered',    (p) => logEvt('ADMIN', 'trip:assignment:offered', p));
  sockAdmin?.on('trip:no_drivers_found',      (p) => logEvt('ADMIN', 'trip:no_drivers_found', p));

  console.log(
    '\nListo. Deja este proceso corriendo y crea el viaje desde Postman.\n' +
    'Deberías ver: PASSENGER::trip:requested, luego PASSENGER::trip:assigning_started\n' +
    'y si hay candidatos, DRIVER::trip:assignment:offered.\n' +
    'Ctrl+C para salir.\n',
  );
})();