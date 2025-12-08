import { Global, Module } from '@nestjs/common';
import { WsServersRegistry } from 'src/realtime/ws-servers.registry';

@Global()
@Module({
  providers: [WsServersRegistry],
  exports: [WsServersRegistry],
})
export class WsCoreModule {}
