import { PartialType } from '@nestjs/mapped-types';
import { CreateAuthCredentialsDto } from './create-auth-credentials.dto';

export class UpdateAuthCredentialsDto extends PartialType(
  CreateAuthCredentialsDto,
) {}
