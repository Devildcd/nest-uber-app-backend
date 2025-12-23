import { PartialType } from '@nestjs/mapped-types';
import { CreatePricePolicyDto } from './create-price-policy.dto';

export class UpdatePricePolicyDto extends PartialType(CreatePricePolicyDto) {}
