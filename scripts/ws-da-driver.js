const io = require('socket.io-client');

const SERVER = process.env.SERVER || 'http://localhost:3000';
const NAMESPACE = process.env.NAMESPACE || '/drivers';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.error('Falta ACCESS_TOKEN (exporta ACCESS_TOKEN=... o edita el archivo)');
  process.exit(1);
}

const socket = io(`${SERVER}${NAMESPACE}`, {
  transports: ['websocket'],
  auth: { token: ACCESS_TOKEN },
  reconnection: false,
});

socket.on('connect', () => {
  console.log('[WS] connected:', socket.id);

  // ---- 1) STATUS: UpdateDriverStatusDto ----
  // Caso A: online + disponible (NO mandes availabilityReason si está disponible)
  socket.emit(
    'driver:status:update',
    {
      isOnline: true,
      isAvailableForTrips: true,
      // availabilityReason: undefined, // no lo envíes en este caso
    },
    (ack) => console.log('[ACK] status:update (available) ->', ack)
  );

  // (Opcional) Caso B: online pero NO disponible de forma explícita
  // setTimeout(() => {
  //   socket.emit(
  //     'driver:status:update',
  //     {
  //       isOnline: true,
  //       isAvailableForTrips: false,
  //       availabilityReason: 'UNAVAILABLE', // AvailabilityReason enum
  //     },
  //     (ack) => console.log('[ACK] status:update (UNAVAILABLE) ->', ack)
  //   );
  // }, 2000);

  // ---- 2) LOCATION: UpdateDriverLocationDto ----
  let lat = Number(process.env.TEST_LAT || 10.4901);
  let lng = Number(process.env.TEST_LNG || -66.8792);

  const ping = () => {
    // pequeño drift para simular movimiento
    lat += (Math.random() - 0.5) * 0.0005;
    lng += (Math.random() - 0.5) * 0.0005;

    socket.emit(
      'driver:location:ping',
      {
        lat,
        lng,
        // lastLocationTimestamp: new Date().toISOString(), // envíalo solo si quieres forzar timestamp
      },
      (ack) => console.log('[ACK] location:ping ->', ack)
    );
  };

  // primer ping inmediato + cada 3s (ajústalo a tu rate limit)
  ping();
  const locInterval = setInterval(ping, 3000);
  socket._locInterval = locInterval;

  // ---- 3) TRIP (tu DTO suele ser { currentTripId: string | null }) ----
  setTimeout(() => {
    const tripId = process.env.TEST_TRIP_ID || '00000000-0000-0000-0000-000000000001';
    console.log('[TEST] set currentTripId =', tripId);
    socket.emit('driver:trip:set', { currentTripId: tripId }, (ack) =>
      console.log('[ACK] trip:set ->', ack)
    );
  }, 5000);

  setTimeout(() => {
    console.log('[TEST] clear currentTripId');
    socket.emit('driver:trip:set', { currentTripId: null }, (ack) =>
      console.log('[ACK] trip:clear ->', ack)
    );
  }, 10000);
});

socket.on('disconnect', (reason) => {
  console.log('[WS] disconnected:', reason);
  if (socket._locInterval) clearInterval(socket._locInterval);
});

socket.on('connect_error', (err) =>
  console.error('[WS] connect_error:', err?.message || err)
);

// ---- Eventos que emite tu servidor ----
socket.on('driver:availability:update', (p) =>
  console.log('[EVT] driver:availability:update', p)
);
socket.on('driver:location:update', (p) =>
  console.log('[EVT] driver:location:update', p)
);
socket.on('driver:trip:update', (p) =>
  console.log('[EVT] driver:trip:update', p)
);

// (opcional) si también re-envías eventos de auth en /drivers:
socket.on('auth:logged_in', (p) => console.log('[EVT] auth:logged_in', p));
socket.on('auth:session_refreshed', (p) => console.log('[EVT] auth:session_refreshed', p));
socket.on('auth:session_revoked', (p) => console.log('[EVT] auth:session_revoked', p));
