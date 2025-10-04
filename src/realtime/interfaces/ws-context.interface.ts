export interface DriverSocketData {
  userId: string;
  driverId?: string; // igual a userId si es DRIVER
  jti: string; // session id del JWT
  sessionId: string; // PK de la fila sessions
  sessionType?: string; // 'mobile_app' | 'web' | ...
  userType: 'DRIVER' | 'PASSENGER' | 'ADMIN' | string;
}

// declare module 'socket.io' {
//   interface Socket {
//     data: DriverSocketData;
//   }
// }
