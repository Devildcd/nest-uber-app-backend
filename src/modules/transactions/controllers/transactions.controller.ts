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
} from '@nestjs/swagger';
import { TransactionsService } from '../services/transactions.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { TransactionListItemDto } from '../dto/transaction-list-item.dto';
import { TransactionDetailDto } from '../dto/transaction-detail.dto';
import { CreateTransactionResponseDto } from '../dto/create-transaction-response.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TransactionFiltersDto } from '../dto/transaction-filters.dto';
import { ApiResponse as ApiResponseInterface } from 'src/common/interfaces/api-response.interface';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { plainToInstance } from 'class-transformer';
import { TransactionListResponseDto } from '../dto/transaction-list-item-response.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List transactions (paginated) with filters' })
  @ApiOkResponse({
    description: 'List of transactions (paginated)',
    type: TransactionListItemDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query() filters?: TransactionFiltersDto,
  ): Promise<ApiResponseInterface<TransactionListItemDto[]>> {
    this.logger.log('Listing transactions', { pagination, filters });
    const apiResponse = await this.transactionsService.findAll(pagination, filters);
    return plainToInstance(TransactionListResponseDto, apiResponse, {
          excludeExtraneousValues: true,
        });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get transaction detail by id' })
  @ApiOkResponse({
    description: 'Transaction detail',
    type: TransactionDetailDto,
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async findById(
    @Param('id') id: string,
  ): Promise<ApiResponseInterface<TransactionDetailDto>> {
    this.logger.log(`Fetching transaction ${id}`);
    return this.transactionsService.findById(id);
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiCreatedResponse({
    description: 'Transaction created successfully',
    type: CreateTransactionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiConflictResponse({ description: 'Conflict (duplicate / business rule)' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async create(
    @Body() createDto: CreateTransactionDto,
  ): Promise<ApiResponseInterface<TransactionDetailDto>> {
    this.logger.log('Creating transaction', createDto);
    return this.transactionsService.create(createDto);
  }

  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a transaction' })
  @ApiOkResponse({ description: 'Transaction updated', type: TransactionDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or params' })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiConflictResponse({ description: 'Conflict (duplicate / business rule)' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTransactionDto,
  ): Promise<ApiResponseInterface<TransactionDetailDto>> {
    this.logger.log(`Updating transaction ${id}`, updateDto);
    return this.transactionsService.update(id, updateDto);
  }

  @Public()
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a transaction' })
  @ApiOkResponse({ description: 'Transaction soft-deleted' })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async remove(
    @Param('id') id: string,
  ): Promise<ApiResponseInterface<null>> {
    this.logger.log(`Deleting transaction ${id}`);
    return this.transactionsService.remove(id);
  }
}

