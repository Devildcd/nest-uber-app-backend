import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

type KnownNs = '/passengers' | '/drivers' | '/admin';

@Injectable()
export class WsServersRegistry {
  private readonly logger = new Logger(WsServersRegistry.name);
  private readonly map = new Map<KnownNs, Server>();

  register(namespace: KnownNs, server: Server) {
    this.map.set(namespace, server);
    this.logger.log(`register ns=${namespace} registryInstance=${this as any}`);
  }
  get(namespace: KnownNs): Server | undefined {
    const s = this.map.get(namespace);
    this.logger.log(
      `get ns=${namespace} hit=${!!s} registryInstance=${this as any}`,
    );
    return s;
  }
}
