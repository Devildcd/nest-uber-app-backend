import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from '../dto/create-transactions.dto';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}

