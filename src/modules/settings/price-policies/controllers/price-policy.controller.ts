import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { PricePolicyService } from '../services/price-policy.service';
import { CreatePricePolicyDto } from '../dtos/create-price-policy.dto';
import { UpdatePricePolicyDto } from '../dtos/update-price-policy.dto';
import { PricePoliciesQueryDto } from '../dtos/price-policies-query.dto';
import { PricePolicy } from '../entities/price-policy.entity';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { SetActiveDto } from '../../cities/dtos/set-active.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@ApiTags('price-policies')
@Controller('price-policies')
export class PricePolicyController {
  constructor(private readonly pricePolicyService: PricePolicyService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: ApiResponseDto, description: 'Price policies list' })
  list(
    @Query() q: PricePoliciesQueryDto,
  ): Promise<ApiResponseDto<PricePolicy[], PaginationMetaDto>> {
    return this.pricePolicyService.findAll(q);
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: ApiResponseDto })
  getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<PricePolicy>> {
    return this.pricePolicyService.getById(id);
  }

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create price policy' })
  @ApiBody({ type: CreatePricePolicyDto })
  @ApiCreatedResponse({
    type: ApiResponseDto,
    description: 'Price policy created',
  })
  @ApiConflictResponse({
    description: 'Scope coherence or constraint conflict',
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  create(
    @Body() dto: CreatePricePolicyDto,
  ): Promise<ApiResponseDto<PricePolicy>> {
    return this.pricePolicyService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update price policy (partial)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdatePricePolicyDto })
  @ApiOkResponse({ type: ApiResponseDto, description: 'Price policy updated' })
  @ApiConflictResponse({ description: 'Scope coherence conflict' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePricePolicyDto,
  ): Promise<ApiResponseDto<PricePolicy>> {
    return this.pricePolicyService.update(id, dto);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Activate/deactivate price policy' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: SetActiveDto })
  @ApiOkResponse({ type: ApiResponseDto })
  setActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetActiveDto,
  ): Promise<ApiResponseDto<PricePolicy>> {
    return this.pricePolicyService.setActive(id, dto.active);
  }
}
