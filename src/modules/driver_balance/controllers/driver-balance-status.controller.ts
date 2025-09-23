import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { DriverBalanceService } from '../services/driver_balance.service';
import { BlockDriverWalletDto } from '../dto/block-driver-wallet.dto';
import { WalletStatusResponseDto } from '../dto/wallet-status-response.dto';
import { UnblockDriverWalletDto } from '../dto/unblock-driver-wallet.dto';
import { formatSuccessResponse } from 'src/common/utils/api-response.utils';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@ApiTags('wallets-status')
@Controller('wallets-status/:driverId')
export class WalletsStatusController {
  private readonly logger = new Logger(WalletsStatusController.name);
  constructor(private readonly walletsService: DriverBalanceService) {}

  @Public()
  @Post('block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bloquear wallet del driver',
    description:
      'Cambia el estado del wallet a "blocked". En este estado se impiden payouts y otros egresos; se permiten topups y ajustes de regularización.',
  })
  @ApiParam({ name: 'driverId', description: 'UUID del driver' })
  @ApiBody({ type: BlockDriverWalletDto })
  @ApiOkResponse({
    description: 'Wallet bloqueado (idempotente)',
    type: WalletStatusResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Wallet no encontrado' })
  @ApiBadRequestResponse({ description: 'Petición inválida' })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async block(
    @Param('driverId', new ParseUUIDPipe({ version: '4' })) driverId: string,
    @Body() body: BlockDriverWalletDto,
  ) {
    const result = await this.walletsService.blockDriverWallet(driverId, body);
    const response: WalletStatusResponseDto = {
      driverId,
      previousStatus: result.previousStatus,
      status: result.status,
      changed: result.changed,
      changedAt: result.changedAt,
    };
    return formatSuccessResponse(
      result.changed
        ? 'Wallet bloqueado.'
        : 'Wallet ya estaba bloqueado (idempotente).',
      response,
    );
  }

  @Public()
  @Post('unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desbloquear wallet del driver',
    description: 'Cambia el estado del wallet a "active".',
  })
  @ApiParam({ name: 'driverId', description: 'UUID del driver' })
  @ApiBody({ type: UnblockDriverWalletDto })
  @ApiOkResponse({
    description: 'Wallet desbloqueado (idempotente)',
    type: WalletStatusResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Wallet no encontrado' })
  @ApiBadRequestResponse({ description: 'Petición inválida' })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async unblock(
    @Param('driverId', new ParseUUIDPipe({ version: '4' })) driverId: string,
    @Body() body: UnblockDriverWalletDto,
  ) {
    const result = await this.walletsService.unblockDriverWallet(
      driverId,
      body,
    );
    const response: WalletStatusResponseDto = {
      driverId,
      previousStatus: result.previousStatus,
      status: result.status,
      changed: result.changed,
      changedAt: result.changedAt,
    };
    return formatSuccessResponse(
      result.changed
        ? 'Wallet desbloqueado.'
        : 'Wallet ya estaba activo (idempotente).',
      response,
    );
  }
}
