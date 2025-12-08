import { AppAudience } from '../dto/login.dto';

export const cookieNameFor = (aud: AppAudience) => `rt_${aud}` as const;
// Útil para aislar por path en local (mismo host)
export const cookiePathFor = (aud: AppAudience) => `/auth/${aud}`;
