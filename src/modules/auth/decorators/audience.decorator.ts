import { SetMetadata } from '@nestjs/common';
import { AppAudience } from '../dto/login.dto';

export const AUDIENCE_KEY = 'audience';
export const Audience = (aud: AppAudience | AppAudience[]) =>
  SetMetadata(AUDIENCE_KEY, aud);
