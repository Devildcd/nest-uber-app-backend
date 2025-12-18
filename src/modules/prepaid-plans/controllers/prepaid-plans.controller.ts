// prepaid-plans/prepaid-plans.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Headers,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PrepaidPlansService } from '../services/prepaid-plans.service';
import { CreatePrepaidPlanDto } from '../dto/create-prepaid-plan.dto';
import { UpdatePrepaidPlanDto } from '../dto/update-prepaid-plan.dto';
import { QueryPrepaidPlanDto } from '../dto/query-prepaid-plan.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { PrepaidPlanResponseDto } from '../dto/prepaid-plan-response.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { PurchasePrepaidPlanResponseDto } from '../dto/purchase-prepaid-plan-response.dto';
import { PurchasePrepaidPlanCashDto } from '../dto/purchase-prepaid-plan-cash.dto';
import { PurchasePrepaidPlanWalletDto } from '../dto/purchase-prepaid-plan-wallet.dto';
import { UserActivePrepaidPlanResponseDto } from '../dto/user-active-prepaid-plan-response.dto';

@ApiTags('Prepaid Plans')
@Controller('prepaid-plans')
export class PrepaidPlansController {
  constructor(private readonly service: PrepaidPlansService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Crear un plan prepago' })
  @ApiCreatedResponse({
    description: 'Plan creado',
    type: ApiResponseDto<PrepaidPlanResponseDto>, // anotación indicativa para Swagger
  })
  @ApiBadRequestResponse({ description: 'Validación fallida' })
  create(
    @Body() dto: CreatePrepaidPlanDto,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    return this.service.create(dto);
  }

 
  @Get()
  @ApiOperation({ summary: 'Listar planes (paginado/filtrado)' })
  @ApiOkResponse({
    description: 'Listado paginado',
    type: ApiResponseDto<PrepaidPlanResponseDto[]>, // indicativo
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'currency', required: false, example: 'CUP' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    example: 'true',
    description: 'true/false',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    example: 'pack 10',
    description: 'búsqueda por nombre',
  })
  findAll(
    @Query() q: QueryPrepaidPlanDto,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto[], PaginationMetaDto>> {
    return this.service.findAll(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un plan por ID' })
  @ApiOkResponse({
    description: 'Plan encontrado',
    type: ApiResponseDto<PrepaidPlanResponseDto>, // indicativo
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un plan' })
  @ApiOkResponse({
    description: 'Plan actualizado',
    type: ApiResponseDto<PrepaidPlanResponseDto>, // indicativo
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePrepaidPlanDto,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    return this.service.update(id, dto);
  }

  @Patch(':id/active/:value')
  @ApiOperation({ summary: 'Activar/Desactivar un plan' })
  @ApiOkResponse({
    description: 'Estado actualizado',
    type: ApiResponseDto<PrepaidPlanResponseDto>, // indicativo
  })
  toggleActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('value', new ParseBoolPipe()) value: boolean,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    return this.service.toggleActive(id, value);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un plan (hard delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<ApiResponseDto<null>> {
    
    return this.service.remove(id);
  }
  
  @Public()
  @Post('purchase')
  @ApiOperation({ summary: 'Compra de plan prepago en efectivo' })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Clave para evitar compras duplicadas' })
  @ApiCreatedResponse({ type: ApiResponseDto<PurchasePrepaidPlanResponseDto> as any })
  @ApiBadRequestResponse()
  purchaseCash(
    @Body() dto: PurchasePrepaidPlanCashDto,
    @Headers('idempotency-key') idemKey?: string,
  ): Promise<ApiResponseDto<PurchasePrepaidPlanResponseDto>> {
    return this.service.purchaseCash(dto, idemKey);
  }
  
  @Post('purchase-wallet')
  @ApiOperation({ summary: 'Compra de plan prepago usando la wallet del driver' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave para evitar compras duplicadas',
  })
  @ApiCreatedResponse({
    type: (ApiResponseDto<PurchasePrepaidPlanResponseDto> as unknown) as any,
  })
  @ApiBadRequestResponse()
  purchaseWithWallet(
    @Body() dto: PurchasePrepaidPlanWalletDto,
    @Headers('idempotency-key') idemKey?: string,
  ): Promise<ApiResponseDto<PurchasePrepaidPlanResponseDto>> {
    return this.service.purchaseWithWallet(dto, idemKey);
  }

  /**
   * Devuelve el mejor plan ACTIVO (si existe) para el usuario.
   * GET /api/prepaid-plans/users/:userId/active
   */
  @Get('users/:userId/active')
  @ApiOperation({ summary: 'Obtener el plan activo del usuario (mejor candidato)' })
  @ApiOkResponse({
    // Envelope estándar con data: UserActivePrepaidPlanResponseDto | null
    type: ApiResponseDto<UserActivePrepaidPlanResponseDto> as any,
  })
  getActiveForUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<ApiResponseDto<UserActivePrepaidPlanResponseDto | null>> {
    return this.service.getActiveForUser(userId);
  }

  /**
   * Lista TODOS los planes activos del usuario (ordenados por prioridad).
   * GET /api/prepaid-plans/users/:userId/actives
   */
  @Get('users/:userId/actives')
  @ApiOperation({ summary: 'Listar todos los planes activos del usuario' })
  @ApiOkResponse({
    // Envelope estándar con data: UserActivePrepaidPlanResponseDto[]
    type: ApiResponseDto<UserActivePrepaidPlanResponseDto[]> as any,
  })
  listActiveForUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<ApiResponseDto<UserActivePrepaidPlanResponseDto[]>> {
    return this.service.listActiveForUser(userId);
  }
}

