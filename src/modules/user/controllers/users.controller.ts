import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Logger,
  Body,
  Get,
  Query,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { RegisterUserDto } from '../dto/register-user.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UserFiltersDto } from '../dto/user-filters.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { ChangePasswordDto } from 'src/modules/auth/dto/change-password.dto';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { RegisterUserResponseDto } from '../dto/register-user-response.dto';
import { plainToInstance } from 'class-transformer';
import { UsersListResponseDto } from '../dto/users-list-response.dto';
import { UserResponseWrapperDto } from '../dto/user-response-wrapper.dto';
import { ChangePasswordResponseDto } from 'src/modules/auth/dto/change-password-response.dto';

@ApiTags('users')
@Controller('users')
// @UseGuards(AuthGuard, RolesGuard)
// @Roles('admin')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly authCredService: AuthService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user with credentials' })
  @ApiBody({ type: RegisterUserDto })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: RegisterUserResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email already registered or credentials exist',
  })
  async register(
    @Body() dto: RegisterUserDto,
  ): Promise<RegisterUserResponseDto> {
    this.logger.log(`Registering user: ${dto.user.email}`);
    const apiResp = await this.userService.register(dto);

    return plainToInstance(RegisterUserResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Get paginated list of users (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  // otros query params definidos en UserFiltersDto...
  @ApiOkResponse({
    description: 'Users retrieved successfully',
    type: UsersListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admins only' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query() filters?: UserFiltersDto,
  ): Promise<UsersListResponseDto> {
    this.logger.log(
      `Fetching users — page ${pagination.page}, limit ${pagination.limit}`,
    );
    const apiResp = await this.userService.findAll(pagination, filters);

    return plainToInstance(UsersListResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single user by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to retrieve',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User retrieved successfully',
    type: UserResponseWrapperDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
  async findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseWrapperDto> {
    this.logger.log(`Fetching user by id: ${id}`);
    const apiResp: ApiResponse<any> = await this.userService.findById(id);
    return plainToInstance(UserResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update a user (name, email, phone)' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to update',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User updated successfully',
    type: UserResponseWrapperDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseWrapperDto> {
    this.logger.log(`Updating user ${id}`);
    const apiResp: ApiResponse<any> = await this.userService.update(id, dto);

    return plainToInstance(UserResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Password updated successfully',
    type: ChangePasswordResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid password format' })
  @ApiNotFoundResponse({ description: 'User or credentials not found' })
  async changePassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    this.logger.log(`Changing password for user ${id}`);
    const apiResp: ApiResponse<null> =
      await this.authCredService.changePassword(id, dto);
    return plainToInstance(ChangePasswordResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a user by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to delete',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<null>> {
    this.logger.log(`Deleting user ${id}`);
    return this.userService.remove(id);
  }
}
