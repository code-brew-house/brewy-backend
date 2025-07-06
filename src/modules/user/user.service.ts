import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { IUser, ICreateUser } from './types/user.types';
import { PasswordUtil } from '../../common/utils/password.util';

/**
 * UserService handles business logic for user management operations.
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new user with validation for duplicate email/username.
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // Check for duplicate email
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });
      if (existingEmail) {
        console.error(
          `[CREATE ERROR] Email already exists: ${createUserDto.email}`,
        );
        throw new ConflictException('Email already exists');
      }

      // Check for duplicate username
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: createUserDto.username },
      });
      if (existingUsername) {
        console.error(
          `[CREATE ERROR] Username already exists: ${createUserDto.username}`,
        );
        throw new ConflictException('Username already exists');
      }

      // Hash password before storing
      const hashedPassword = await PasswordUtil.hashPassword(
        createUserDto.password,
      );

      // Create user
      const user = await this.prisma.user.create({
        data: {
          username: createUserDto.username,
          email: createUserDto.email,
          password: hashedPassword,
          fullName: createUserDto.fullName,
        },
      });

      console.log(`[CREATE SUCCESS] User created: ${user.id}`);
      return new UserResponseDto(user);
    } catch (error) {
      console.error(`[CREATE ERROR] Failed to create user: ${error.message}`);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create user: ' + error.message,
      );
    }
  }

  /**
   * Finds a user by email address.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        console.log(`[FIND SUCCESS] User found by email: ${email}`);
      } else {
        console.log(`[FIND INFO] User not found by email: ${email}`);
      }

      return user;
    } catch (error) {
      console.error(
        `[FIND ERROR] Failed to find user by email: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to find user by email: ' + error.message,
      );
    }
  }

  /**
   * Finds a user by username.
   */
  async findByUsername(username: string): Promise<IUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        console.log(`[FIND SUCCESS] User found by username: ${username}`);
      } else {
        console.log(`[FIND INFO] User not found by username: ${username}`);
      }

      return user;
    } catch (error) {
      console.error(
        `[FIND ERROR] Failed to find user by username: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to find user by username: ' + error.message,
      );
    }
  }

  /**
   * Finds a user by ID.
   */
  async findById(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        console.error(`[FIND ERROR] User not found: ${id}`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      console.log(`[FIND SUCCESS] User retrieved: ${id}`);
      return new UserResponseDto(user);
    } catch (error) {
      console.error(`[FIND ERROR] Failed to find user by ID: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to find user by ID: ' + error.message,
      );
    }
  }

  /**
   * Updates a user's information.
   */
  async update(
    id: string,
    updateData: Partial<ICreateUser>,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
      });

      console.log(`[UPDATE SUCCESS] User updated: ${id}`);
      return new UserResponseDto(user);
    } catch (error) {
      if (error.code === 'P2025') {
        console.error(`[UPDATE ERROR] User not found: ${id}`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      console.error(`[UPDATE ERROR] Failed to update user: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to update user: ' + error.message,
      );
    }
  }

  /**
   * Validates a user's password for authentication.
   */
  async validatePassword(user: IUser, password: string): Promise<boolean> {
    try {
      const isValid = await PasswordUtil.comparePassword(
        password,
        user.password,
      );
      console.log(
        `[VALIDATE SUCCESS] Password validation for user: ${user.id}`,
      );
      return isValid;
    } catch (error) {
      console.error(
        `[VALIDATE ERROR] Failed to validate password: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to validate password: ' + error.message,
      );
    }
  }

  /**
   * Deletes a user by ID.
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });

      console.log(`[DELETE SUCCESS] User deleted: ${id}`);
    } catch (error) {
      if (error.code === 'P2025') {
        console.error(`[DELETE ERROR] User not found: ${id}`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      console.error(`[DELETE ERROR] Failed to delete user: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to delete user: ' + error.message,
      );
    }
  }
}
