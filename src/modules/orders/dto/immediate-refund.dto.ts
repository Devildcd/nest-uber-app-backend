import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ImmediateRefundDto {
  @IsUUID()
  adminId: string;

  @IsOptional()
  @IsString()
  reason?: string;

  /**
   * Optional: window in minutes. If omitted, defaults to service's default (15 minutes).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  policyWindowMinutes?: number;
}
