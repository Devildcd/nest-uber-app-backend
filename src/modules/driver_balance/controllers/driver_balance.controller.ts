import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DriverBalanceService } from '../services/driver_balance.service';
import { DriverBalanceDepositDto } from '../../driver_balance/dto/update-driver-balance-deposit.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateDriverBalanceDto } from '../dto/create-driver_balance.dto';
import { CreateDriverBalanceResponseDto } from '../dto/create-driver-balance-response.dto';
import { ApplyCashCommissionDto } from 'src/modules/transactions/dto/apply-cash-commission.dto';
import { CashCommissionResponseDto } from '../dto/cash-commission-response.dto';
import { formatSuccessResponse } from 'src/common/utils/api-response.utils';
import { CreateCashTopupDto } from '../dto/create-cash-topup.dto';
import { CashTopupCreatedResponseDto } from '../dto/cash-topup-created-response.dto';
import { ConfirmCashTopupDto } from '../dto/confirm-cash-topup.dto';
import { CashTopupConfirmedResponseDto } from '../dto/cash-topup-confirmed-response.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@ApiTags('drivers-balance')
@Controller('drivers-balance')
export class DriverBalanceController {
  private readonly logger = new Logger(DriverBalanceController.name);
  constructor(private readonly driverBalanceService: DriverBalanceService) {}

  //Crear recarga de wallet en efectivo (CCR pending)
  @Public()
  @Post(':driverId/topups')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear depósito en efectivo (CCR pending)',
    description:
      'Valida punto activo y crea Transaction (WALLET_TOPUP, PENDING) + CCR(PENDING).',
  })
  @ApiParam({ name: 'driverId', description: 'UUID del driver' })
  @ApiBody({ type: CreateCashTopupDto })
  @ApiCreatedResponse({
    description: 'CCR creado',
    type: CashTopupCreatedResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Petición inválida' })
  @ApiConflictResponse({ description: 'CCR duplicado (uq_ccr_transaction)' })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async createCashTopup(
    @Param('driverId', new ParseUUIDPipe({ version: '4' })) driverId: string,
    @Body() body: CreateCashTopupDto,
  ) {
    const { ccr, tx, amount, currency } =
      await this.driverBalanceService.createCashTopupPending(driverId, body);
    const res: CashTopupCreatedResponseDto = {
      cashCollectionRecordId: ccr.id,
      transactionId: tx.id,
      status: ccr.status,
      currency,
      amount: amount.toFixed(2),
      collectionPointId: body.collectionPointId,
      collectedByUserId: body.collectedByUserId,
    };
    return formatSuccessResponse('CashCollectionRecord creado (pending).', res);
  }
  //Confirmar recraga de wallet en efectivo
  @Public()
  @Post('topups/:ccrId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar depósito en efectivo',
    description:
      'Bloquea wallet, aplica crédito, marca CCR completed y Transaction processed.',
  })
  @ApiParam({ name: 'driverId', description: 'UUID del driver' })
  @ApiParam({ name: 'ccrId', description: 'UUID del CashCollectionRecord' })
  @ApiBody({ type: ConfirmCashTopupDto })
  @ApiOkResponse({
    description: 'Topup confirmado',
    type: CashTopupConfirmedResponseDto,
  })
  @ApiNotFoundResponse({ description: 'CCR o Wallet no encontrado' })
  @ApiBadRequestResponse({
    description: 'Petición inválida / Estado inconsistente',
  })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async confirmCashTopup(
    @Param('ccrId', new ParseUUIDPipe({ version: '4' })) ccrId: string,
    @Body() body: ConfirmCashTopupDto,
  ) {
    const {
      wallet,
      movement,
      ccrId: id,
      txId,
      amount,
      currency,
    } = await this.driverBalanceService.confirmCashTopup(ccrId, body);

    const res: CashTopupConfirmedResponseDto = {
      cashCollectionRecordId: id,
      transactionId: txId,
      status: 'completed',
      currency,
      amount: amount.toFixed(2),
      previousBalance: Number(movement.previousBalance).toFixed(2),
      newBalance: Number(movement.newBalance).toFixed(2),
    };

    return formatSuccessResponse('Depósito confirmado.', res);
  }

  /**
   * Consultar el saldo actual de la billetera de un driver.
   */
  /*@Get(':driverId')
  async getBalance(@Param('driverId') driverId: string) {
    return this.driverBalanceService.getBalance(driverId);
  }*/
}
