import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
  Query,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';
import { AddUserToOrganizationDto } from './dto/add-user-to-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request.types';
import { UserService } from '../user/user.service';
import { UserResponseDto } from '../user/dto/user-response.dto';

/**
 * OrganizationController handles HTTP endpoints for organization management operations.
 * Provides endpoints for CRUD operations on organizations with role-based access control.
 */
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
  ) {}

  /**
   * Create a new organization
   * TODO: Add @UseGuards(RolesGuard) and @Roles('SUPER_OWNER') when available
   * @param createOrganizationDto - Organization creation data
   * @returns Created organization information
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  async create(
    @Body() createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    try {
      const organization = await this.organizationService.create(
        createOrganizationDto,
      );
      return new OrganizationResponseDto(organization);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error(
        `[CREATE ERROR] Failed to create organization: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to create organization');
    }
  }

  /**
   * Get all organizations with optional filtering
   * TODO: Add organization filtering based on user role and context
   * @param name - Optional filter by organization name
   * @param email - Optional filter by organization email
   * @returns List of organizations
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Query('name') _name?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Query('email') _email?: string,
  ): Promise<OrganizationResponseDto[]> {
    try {
      // TODO: Implement filtering based on query parameters
      // TODO: Add organization context filtering based on user role
      const organizations = await this.organizationService.findAll();
      return organizations.map((org) => new OrganizationResponseDto(org));
    } catch (error) {
      console.error(
        `[FIND_ALL ERROR] Failed to retrieve organizations: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve organizations',
      );
    }
  }

  /**
   * Get organization by ID
   * TODO: Add organization access validation
   * @param id - UUID of the organization to retrieve
   * @returns Organization information by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    try {
      const organization = await this.organizationService.findOne(id);
      if (!organization) {
        throw new NotFoundException(`Organization with ID ${id} not found`);
      }
      return new OrganizationResponseDto(organization);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        `[FIND_ONE ERROR] Failed to retrieve organization: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to retrieve organization');
    }
  }

  /**
   * Update organization by ID
   * TODO: Add organization access validation and role checks
   * @param id - UUID of the organization to update
   * @param updateOrganizationDto - Organization update data
   * @returns Updated organization information
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    try {
      const organization = await this.organizationService.update(
        id,
        updateOrganizationDto,
      );
      return new OrganizationResponseDto(organization);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      console.error(
        `[UPDATE ERROR] Failed to update organization: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to update organization');
    }
  }

  /**
   * Delete organization by ID
   * TODO: Add organization access validation and role checks
   * TODO: Implement soft delete with archival (task 7.0)
   * @param id - UUID of the organization to delete
   * @returns Deleted organization information
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    try {
      const organization = await this.organizationService.remove(id);
      return new OrganizationResponseDto(organization);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        `[DELETE ERROR] Failed to delete organization: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to delete organization');
    }
  }

  /**
   * Increment member count for an organization
   * TODO: Add organization access validation
   * @param id - UUID of the organization
   * @returns Updated organization information
   */
  @Post(':id/increment-members')
  @HttpCode(HttpStatus.OK)
  async incrementMemberCount(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    try {
      const organization =
        await this.organizationService.incrementMemberCount(id);
      return new OrganizationResponseDto(organization);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        `[INCREMENT ERROR] Failed to increment member count: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to increment member count',
      );
    }
  }

  /**
   * Decrement member count for an organization
   * TODO: Add organization access validation
   * @param id - UUID of the organization
   * @returns Updated organization information
   */
  @Post(':id/decrement-members')
  @HttpCode(HttpStatus.OK)
  async decrementMemberCount(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    try {
      const organization =
        await this.organizationService.decrementMemberCount(id);
      return new OrganizationResponseDto(organization);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error(
        `[DECREMENT ERROR] Failed to decrement member count: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to decrement member count',
      );
    }
  }

  /**
   * Add a user to an organization (Super Owner only)
   * Used to add the first Owner to a new organization
   * @param id - UUID of the organization
   * @param addUserDto - User creation data
   * @param currentUser - Current authenticated user
   * @returns Created user information
   */
  @Post(':id/users')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('SUPER_OWNER')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  async addUserToOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addUserDto: AddUserToOrganizationDto,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UserResponseDto> {
    try {
      // Verify organization exists
      const organization = await this.organizationService.findOne(id);
      if (!organization) {
        throw new NotFoundException(`Organization with ID ${id} not found`);
      }

      // Create user data with organization context
      const userData = {
        username: addUserDto.username,
        email: addUserDto.email,
        password: addUserDto.password,
        fullName: addUserDto.fullName,
        organizationId: id,
        role: addUserDto.role,
      };

      // Create user with Super Owner privileges
      const user = await this.userService.create(
        userData,
        currentUser.role,
        currentUser.id,
      );

      return user;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error(
        `[ADD_USER ERROR] Failed to add user to organization: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to add user to organization',
      );
    }
  }

  /**
   * Get all organizations for Super Owner administration
   * Provides comprehensive view of all organizations in the system
   * Accessible at: GET /organizations/admin
   * @param name - Optional filter by organization name
   * @param email - Optional filter by organization email
   * @param limit - Optional limit for pagination
   * @param offset - Optional offset for pagination
   * @returns List of all organizations with metadata
   */
  @Get('admin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('SUPER_OWNER')
  async getAllOrganizationsForAdmin(
    @Query('name') _name?: string,
    @Query('email') _email?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    organizations: OrganizationResponseDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;

      // Build filters
      const filters = {
        name: _name?.trim(),
        email: _email?.trim()?.toLowerCase(),
        limit: parsedLimit,
        offset: parsedOffset,
      };

      // Get organizations with filtering and pagination
      const result = await this.organizationService.findAllForAdmin(filters);

      return {
        organizations: result.organizations.map(
          (org) => new OrganizationResponseDto(org),
        ),
        total: result.total,
        limit: parsedLimit,
        offset: parsedOffset,
      };
    } catch (error) {
      console.error(
        `[ADMIN_FIND_ALL ERROR] Failed to retrieve organizations for admin: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve organizations for admin',
      );
    }
  }
}
