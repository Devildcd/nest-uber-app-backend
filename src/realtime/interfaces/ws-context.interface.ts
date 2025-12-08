export interface DriverSocketData {
  userId: string;
  driverId?: string; // igual a userId si es DRIVER
  jti: string; // session id del JWT (sid)
  sessionId: string; // PK de la fila sessions (puede ser igual al jti si no tienes otro ID)
  sessionType?: string;
  userType: 'DRIVER' | 'PASSENGER' | 'ADMIN' | string;
}

// declare module 'socket.io' {
//   interface Socket {
//     data: DriverSocketData;
//   }
// }
