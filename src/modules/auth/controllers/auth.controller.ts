import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { plainToInstance } from 'class-transformer';
import { Response as ExpressResponse } from 'express';
import { Public } from '../decorators/public.decorator';

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

    // Transformamos solo en caso de éxito
    return plainToInstance(
      LoginResponseDto,
      { accessToken, refreshToken },
      {
        excludeExtraneousValues: true,
      },
    );
  }
}
