import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { plainToInstance } from 'class-transformer';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { Public } from '../decorators/public.decorator';
import { RefreshResponseDto } from '../dto/refresh-response.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and create session' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Login successful', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiCookieAuth()
  async login(
    @Req() req: ExpressRequest,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponseDto> {
    this.logger.log(`Logging in user: ${dto.email ?? dto.phoneNumber}`);

    const {
      accessToken,
      refreshToken, // sólo vendrá para mobile / cuando el service lo retorna
      sessionType,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    } = await this.authService.login(dto, req, res);

    return plainToInstance(
      LoginResponseDto,
      {
        accessToken: accessToken ?? null,
        // Si refreshToken no viene (porque se puso en cookie) no lo incluimos en body
        ...(refreshToken ? { refreshToken } : {}),
        sessionType,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a valid refresh token' })
  @ApiCookieAuth()
  @ApiBody({
    description: 'For API/Mobile clients: send { refreshToken } in body',
    schema: { properties: { refreshToken: { type: 'string' } } },
  })
  @ApiOkResponse({
    description: 'New access token issued',
    type: RefreshResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired or revoked refresh token',
  })
  async refresh(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Body('refreshToken') refreshTokenBody: string,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<RefreshResponseDto> {
    this.logger.log('Refreshing access token');

    const cookieRt = req.cookies?.refreshToken;
    const oldRt = cookieRt ?? refreshTokenBody;

    if (!oldRt) {
      // no cookie ni body -> cliente hizo mal la petición
      throw new BadRequestException('No refresh token provided');
    }

    // Sólo pasamos `res` al service si el refresh viene desde la cookie (WEB/API_CLIENT).
    // Si proviene del body (mobile), no queremos que el server fuerce una cookie.
    const passRes = !!cookieRt;

    const {
      accessToken,
      refreshToken, // vendrá únicamente cuando no se usen cookies (mobile)
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      sid,
      sessionType,
    } = await this.authService.refreshTokens(oldRt, passRes ? res : undefined);

    return plainToInstance(
      RefreshResponseDto,
      {
        accessToken,
        // include refreshToken only if service returned it (mobile)
        ...(refreshToken ? { refreshToken } : {}),
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        sid,
        sessionType,
      },
      { excludeExtraneousValues: true },
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and revoke current refresh token' })
  @ApiCookieAuth()
  @ApiNoContentResponse({
    description: 'Refresh token revoked and cookie cleared',
  })
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<void> {
    this.logger.log('Logging out user session');
    const oldRt = req.cookies?.refreshToken;
    await this.authService.logout(oldRt!, res);
  }
}
