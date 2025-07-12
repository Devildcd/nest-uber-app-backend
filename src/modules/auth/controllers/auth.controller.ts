import {
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
import { Response as ExpressResponse } from 'express';
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
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponseDto> {
    this.logger.log(`Logging in user: ${dto.email ?? dto.phoneNumber}`);

    // Si el servicio lanza UnauthorizedException, Nest responderá 401 automáticamente.
    const { accessToken, refreshToken } = await this.authService.login(
      dto,
      res,
    );

    return plainToInstance(
      LoginResponseDto,
      { accessToken, refreshToken },
      {
        excludeExtraneousValues: true,
      },
    );
  }

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
    // accedemos con null‑safe y preferimos la cookie
    const oldRt = req.cookies?.refreshToken ?? refreshTokenBody;
    const { accessToken, refreshToken } = await this.authService.refreshTokens(
      oldRt,
      res,
    );

    return plainToInstance(
      RefreshResponseDto,
      { accessToken, refreshToken },
      { excludeExtraneousValues: true },
    );
  }

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
