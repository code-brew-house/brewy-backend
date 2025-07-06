import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * UserController handles HTTP endpoints for user management operations.
 * Provides endpoints for retrieving user profile and user details.
 */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get current user's profile
   * @param req - Request object containing authenticated user
   * @returns Current user's profile information
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard) // Will be implemented in AuthModule
  async getProfile(@Request() req: any): Promise<UserResponseDto> {
    try {
      // For now, we'll use a placeholder. This will be properly implemented
      // when JWT authentication is added in the AuthModule
      const userId = req.user?.id || req.user?.sub;
      if (!userId || typeof userId !== 'string') {
        throw new NotFoundException('User not authenticated');
      }

      return await this.userService.findById(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve user profile');
    }
  }

  /**
   * Get user by ID
   * @param id - UUID of the user to retrieve
   * @returns User information by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    try {
      return await this.userService.findById(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }
}
