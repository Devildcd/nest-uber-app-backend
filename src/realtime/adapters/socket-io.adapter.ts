// src/realtime/adapters/socket-io.adapter.ts
import { INestApplication, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
// opcional redis
// import { createAdapter } from '@socket.io/redis-adapter';
// import { createClient } from 'ioredis';

export class SocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(SocketIoAdapter.name);

  constructor(private app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const cors = {
      origin: process.env.WS_CORS_ORIGIN?.split(',') ?? '*',
      credentials: true,
    };

    const server = super.createIOServer(port, {
      ...options,
      cors,
      // transports: ['websocket', 'polling'], // default
    });

    // opcional: cluster/escala con redis
    // if (process.env.REDIS_URL) {
    //   const pub = new createClient(process.env.REDIS_URL);
    //   const sub = pub.duplicate();
    //   server.adapter(createAdapter(pub, sub));
    //   this.logger.log('Socket.IO redis adapter enabled');
    // }

    return server;
  }
}
