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
  Query,
} from '@nestjs/common';
import { DriverBalanceService } from '../services/driver_balance.service';
import { DriverBalanceDepositDto } from '../../driver_balance/dto/update-driver-balance-deposit.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
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
import { DriverBalanceResponseDto } from '../dto/driver-balance-response.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { WalletMovementQueryDto } from '../dto/wallet-movements-query.dto';
import { plainToInstance } from 'class-transformer';
import { WalletMovementsListResponseDto } from '../dto/wallet-movements-list-response.dto';

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

  //Obtener saldo del wallet de un driver
  @Public()
  @Get(':driverId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener saldo del wallet de un driver',
    description:
      'Devuelve el balance actual, montos retenidos, totales históricos y metadatos básicos.',
  })
  @ApiParam({ name: 'driverId', description: 'UUID del driver' })
  @ApiOkResponse({
    description: 'Saldo obtenido',
    type: DriverBalanceResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Wallet no encontrado' })
  @ApiBadRequestResponse({ description: 'Parámetros inválidos' })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async getWalletBalance(
    @Param('driverId', new ParseUUIDPipe({ version: '4' })) driverId: string,
  ): Promise<ApiResponse<DriverBalanceResponseDto>> {
    const wallet =
      await this.driverBalanceService.getDriverWalletBalance(driverId);
    return formatSuccessResponse('Saldo obtenido.', wallet);
  }

  @Public()
  @Get(':walletId/movements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated wallet movements by walletId',
  })
  @ApiParam({
    name: 'walletId',
    description: 'UUID de la wallet (driver_balance.id)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'transactionId', required: false, type: String })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'ISO-8601 desde',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'ISO-8601 hasta',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'amount'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortDir',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiOkResponse({
    description: 'Wallet movements retrieved successfully',
    type: WalletMovementsListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiBadRequestResponse({ description: 'Invalid query params' })
  @ApiNotFoundResponse({ description: 'Wallet not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal error' })
  async findAll(
    @Param('walletId', new ParseUUIDPipe({ version: '4' })) walletId: string,
    @Query() pagination: PaginationDto,
    @Query() filters?: WalletMovementQueryDto,
  ): Promise<WalletMovementsListResponseDto> {
    this.logger.log(
      `Fetching wallet movements — walletId=${walletId}, page=${pagination.page}, limit=${pagination.limit}`,
    );

    const apiResp = await this.driverBalanceService.findAllMovements(
      pagination,
      walletId,
      filters,
    );

    return plainToInstance(WalletMovementsListResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }
}
