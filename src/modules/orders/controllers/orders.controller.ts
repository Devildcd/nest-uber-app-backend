import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { OrderListItemDto } from '../dto/order-list-item.dto';
import { OrderDetailDto } from '../dto/order-detail.dto';
import { CreateOrderResponseDto } from '../dto/create-order-response.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { OrderFiltersDto } from '../dto/order-filters.dto';
import { ApiResponse as ApiResponseInterface } from 'src/common/interfaces/api-response.interface';
import { OrderListResponseDto } from '../dto/order-list-response.dto';
import { plainToInstance } from 'class-transformer';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { OrderDataDto } from '../dto/order-data.dto';
import { formatSuccessResponse } from 'src/common/utils/api-response.utils';
import { ConfirmCashOrderDto } from '../dto/confirm-cash-order.dto';
import { ConfirmCashOrderResponseDto } from '../dto/confirm-cash-order-response.dto';
import { ImmediateRefundDto } from '../dto/immediate-refund.dto';
import { NormalRefundDto } from '../dto/order-normal-refund.dto';
import { CommissionAdjustmentResponseDto } from '../dto/comission-adjustment-response.dto';
import { AdjustCommissionDto } from '../dto/comission-adjustment.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List orders (paginated) with filters' })
  @ApiOkResponse({
    description: 'List of orders (paginated)',
    type: OrderListItemDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query() filters?: OrderFiltersDto,
  ): Promise<ApiResponseInterface<OrderListItemDto[]>> {
    this.logger.log('Listing orders', { pagination, filters });
    const apiResponse = await this.ordersService.findAll(pagination, filters);
    return plainToInstance(OrderListResponseDto, apiResponse, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get order detail by id' })
  @ApiOkResponse({ description: 'Order detail', type: OrderDetailDto })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async findById(
    @Param('id') id: string,
  ): Promise<ApiResponseInterface<OrderDetailDto>> {
    this.logger.log(`Fetching order ${id}`);
    return this.ordersService.findById(id);
  }

  @Public()
  @Post(':tripId/trips')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cierre de viaje → Generar Order (pending, CASH)',
    description:
      'Crea la orden de cobro en efectivo al cierre del viaje. Idempotente por trip (uq_orders_trip). Emite evento order.created si se crea.',
  })
  @ApiParam({ name: 'tripId', description: 'UUID del viaje' })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({
    description: 'Order creada',
    type: CreateOrderResponseDto,
  })
  @ApiOkResponse({
    description: 'Order ya existía (idempotente)',
    type: CreateOrderResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Petición inválida' })
  @ApiConflictResponse({ description: 'Orden existente con valores distintos' })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async createTripCashOrder(
    @Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string,
    @Body() body: CreateOrderDto,
  ) {
    const { order, created } =
      await this.ordersService.createCashOrderOnTripClosure(tripId, body);

    const res: OrderDataDto = {
      id: order.id,
      tripId,
      passengerId: body.passengerId,
      driverId: body.driverId,
      requestedAmount: Number(order.requestedAmount).toFixed(2),
      paymentType: order.paymentType,
      status: order.status,
      currency: order.currency || 'CUP',
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };

    return formatSuccessResponse(
      created ? 'Order creada.' : 'Order recuperada (idempotente).',
      res,
    );
  }

  // NOTA: si quieres restringir update/delete a roles internos, remueve @Public() y aplica Guards
  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Partially update an order' })
  @ApiOkResponse({ description: 'Order updated', type: OrderDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or params' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Conflict (duplicate / business rule)' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderDto,
  ): Promise<ApiResponseInterface<OrderDetailDto>> {
    this.logger.log(`Updating order ${id}`, updateDto);
    return this.ordersService.update(id, updateDto);
  }

  //Aprobar orden de pago
  @Public()
  @Patch(':orderId/confirm-cash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar pago en efectivo de una Order (idempotente)',
    description:
      'Aplica la comisión cash al wallet del driver, registra la transacción CHARGE y marca la Order como PAID de forma idempotente.',
  })
  @ApiParam({ name: 'orderId', description: 'UUID de la Order' })
  @ApiBody({ type: ConfirmCashOrderDto })
  @ApiOkResponse({
    description: 'Order confirmada o ya confirmada (idempotente)',
    type: ConfirmCashOrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order no encontrada' })
  @ApiBadRequestResponse({ description: 'Petición inválida / Estado inválido' })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async confirmCashOrder(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() body: ConfirmCashOrderDto,
  ) {
    const result = await this.ordersService.confirmCashOrder(orderId, body);

    return formatSuccessResponse(
      result.alreadyPaid
        ? 'Order ya estaba pagada (idempotente).'
        : 'Order confirmada (PAID) y comisión aplicada.',
      result as ConfirmCashOrderResponseDto,
    );
  }

  @Public()
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an order' })
  @ApiOkResponse({ description: 'Order soft-deleted' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async remove(@Param('id') id: string): Promise<ApiResponseInterface<null>> {
    this.logger.log(`Deleting order ${id}`);
    return this.ordersService.remove(id);
  }

  @Public()
  @Post(':id/immediate-refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Admin: Immediate reversal for a PAID order (within policy window)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the order' })
  @ApiBody({ type: ImmediateRefundDto })
  @ApiOkResponse({
    description:
      'Immediate reversal processed or flagged to run normal refund flow',
  })
  @ApiBadRequestResponse({ description: 'Invalid request or order state' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async immediateRefund(
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() body: ImmediateRefundDto,
  ) {
    this.logger.log(
      `Admin ${body.adminId} requested immediate refund for order ${orderId}`,
      { body },
    );

    // convert minutes -> ms if provided
    const policyWindowMs = body.policyWindowMinutes
      ? body.policyWindowMinutes * 60 * 1000
      : undefined;

    const result = await this.ordersService.processImmediateRefund(orderId, {
      adminId: body.adminId,
      reason: body.reason,
      policyWindowMs,
    });

    // If service indicates the order is outside immediate window, caller should run normal refund flow
    if (result.forceNormalRefund) {
      return formatSuccessResponse(
        'Order is outside immediate reversal window. Please execute normal refund flow.',
        result,
      );
    }

    // Normal positive response
    return formatSuccessResponse(
      result.reverted
        ? 'Immediate reversal processed'
        : 'No action required (idempotent)',
      result,
    );
  }

  @Public()
  @Post(':id/refunds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: Create normal refund for an order (cash / off-platform)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the order' })
  @ApiBody({ type: NormalRefundDto })
  @ApiOkResponse({
    description: 'Refund processed and CCR created (cash off-platform)',
  })
  @ApiBadRequestResponse({ description: 'Invalid request or state' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async normalRefund(
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() body: NormalRefundDto,
  ) {
    this.logger.log(
      `Admin ${body.adminId ?? 'unknown'} requested normal (cash) refund for order ${orderId}`,
      { body },
    );

    const result = await this.ordersService.processNormalRefund(orderId, {
      adminId: body.adminId,
      collectionPointId: body.collectionPointId,
      requestedBy: body.adminId,
      reason: body.reason,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });

    return formatSuccessResponse('Refund request processed', result);
  }

  @Public()
  @Post(':id/commission-adjustments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Adjust commission (post-facto) for an order (idempotent)',
    description:
      'Applies a post-facto commission adjustment to the order/driver. Idempotent by (orderId, adjustmentSeq). ' +
      'Either send deltaFee (positive = platform charges more; negative = platform refunds) or newFee (the final fee), ' +
      'and an adjustmentSeq to guarantee idempotency.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the order' })
  @ApiBody({ type: AdjustCommissionDto })
  @ApiOkResponse({
    description: 'Commission adjusted (or existing adjustment returned)',
    type: CommissionAdjustmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or business rule' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({
    description:
      'Conflict (e.g. amount mismatch or DB unique violation handled)',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async adjustCommission(
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: AdjustCommissionDto,
  ): Promise<ApiResponseInterface<CommissionAdjustmentResponseDto>> {
    this.logger.log(`Adjust commission requested for order ${orderId}`, {
      adjustmentSeq: dto?.adjustmentSeq,
    });

    // Forzamos el orderId desde el path (ignora si viene en el body)
    dto.orderId = orderId;

    const result = await this.ordersService.adjustCommission(orderId, dto);

    return formatSuccessResponse(
      result.alreadyExisted
        ? 'Adjustment already existed (idempotent)'
        : 'Commission adjusted successfully',
      result as CommissionAdjustmentResponseDto,
    );
  }
}
