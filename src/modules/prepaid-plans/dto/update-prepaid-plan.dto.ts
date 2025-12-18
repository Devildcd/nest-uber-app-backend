import { PartialType } from '@nestjs/swagger';
import { CreatePrepaidPlanDto } from './create-prepaid-plan.dto';

export class UpdatePrepaidPlanDto extends PartialType(CreatePrepaidPlanDto) {}

