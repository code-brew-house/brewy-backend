import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  IOrganization,
  IOrganizationService,
} from './types/organization.types';

/**
 * OrganizationService handles business logic for organization management operations.
 */
@Injectable()
export class OrganizationService implements IOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new organization with validation for duplicate email.
   */
  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<IOrganization> {
    try {
      // Check for duplicate email (excluding archived organizations)
      const existingOrganization = await this.prisma.organization.findFirst({
        where: {
          email: createOrganizationDto.email,
          archivedAt: null,
        },
      });
      if (existingOrganization) {
        console.error(
          `[CREATE ERROR] Organization email already exists: ${createOrganizationDto.email}`,
        );
        throw new ConflictException('Organization email already exists');
      }

      // Create organization
      const organization = await this.prisma.organization.create({
        data: {
          name: createOrganizationDto.name,
          email: createOrganizationDto.email,
          contactNumber: createOrganizationDto.contactNumber,
          totalMemberCount: 0,
        },
      });

      console.log(`[CREATE SUCCESS] Organization created: ${organization.id}`);
      return organization;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error(
        `[CREATE ERROR] Failed to create organization: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to create organization: ' + error.message,
      );
    }
  }

  /**
   * Retrieves all non-archived organizations.
   */
  async findAll(): Promise<IOrganization[]> {
    try {
      const organizations = await this.prisma.organization.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      console.log(
        `[FIND_ALL SUCCESS] Retrieved ${organizations.length} organizations`,
      );
      return organizations;
    } catch (error) {
      console.error(
        `[FIND_ALL ERROR] Failed to retrieve organizations: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve organizations: ' + error.message,
      );
    }
  }

  /**
   * Retrieves a non-archived organization by ID.
   */
  async findOne(id: string): Promise<IOrganization | null> {
    try {
      const organization = await this.prisma.organization.findFirst({
        where: {
          id,
          archivedAt: null,
        },
      });

      if (!organization) {
        console.error(
          `[FIND_ONE ERROR] Organization not found or archived: ${id}`,
        );
        throw new NotFoundException(
          `Organization with ID ${id} not found or is archived`,
        );
      }

      console.log(`[FIND_ONE SUCCESS] Organization retrieved: ${id}`);
      return organization;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        `[FIND_ONE ERROR] Failed to retrieve organization: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve organization: ' + error.message,
      );
    }
  }

  /**
   * Updates an organization with validation for duplicate email.
   */
  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<IOrganization> {
    try {
      // Check if organization exists and is not archived
      const existingOrganization = await this.prisma.organization.findFirst({
        where: {
          id,
          archivedAt: null,
        },
      });
      if (!existingOrganization) {
        console.error(
          `[UPDATE ERROR] Organization not found or archived: ${id}`,
        );
        throw new NotFoundException(
          `Organization with ID ${id} not found or is archived`,
        );
      }

      // Check for duplicate email if email is being updated (excluding archived organizations)
      if (
        updateOrganizationDto.email &&
        updateOrganizationDto.email !== existingOrganization.email
      ) {
        const emailExists = await this.prisma.organization.findFirst({
          where: {
            email: updateOrganizationDto.email,
            archivedAt: null,
          },
        });
        if (emailExists) {
          console.error(
            `[UPDATE ERROR] Organization email already exists: ${updateOrganizationDto.email}`,
          );
          throw new ConflictException('Organization email already exists');
        }
      }

      // Update organization
      const updatedOrganization = await this.prisma.organization.update({
        where: { id },
        data: updateOrganizationDto,
      });

      console.log(`[UPDATE SUCCESS] Organization updated: ${id}`);
      return updatedOrganization;
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
      throw new InternalServerErrorException(
        'Failed to update organization: ' + error.message,
      );
    }
  }

  /**
   * Soft deletes an organization by setting archivedAt timestamp.
   */
  async remove(id: string): Promise<IOrganization> {
    try {
      // Check if organization exists and is not already archived
      const existingOrganization = await this.prisma.organization.findUnique({
        where: { id },
      });
      if (!existingOrganization) {
        console.error(`[REMOVE ERROR] Organization not found: ${id}`);
        throw new NotFoundException(`Organization with ID ${id} not found`);
      }

      if (existingOrganization.archivedAt) {
        console.error(`[REMOVE ERROR] Organization already archived: ${id}`);
        throw new BadRequestException(
          `Organization with ID ${id} is already archived`,
        );
      }

      // Soft delete organization by setting archivedAt timestamp
      const archivedOrganization = await this.prisma.organization.update({
        where: { id },
        data: {
          archivedAt: new Date(),
        },
      });

      console.log(`[REMOVE SUCCESS] Organization archived: ${id}`);
      return archivedOrganization;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error(
        `[REMOVE ERROR] Failed to archive organization: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to archive organization: ' + error.message,
      );
    }
  }

  /**
   * Increments the member count for an organization.
   */
  async incrementMemberCount(id: string): Promise<IOrganization> {
    try {
      // Check if organization exists and is not archived
      const existingOrganization = await this.prisma.organization.findFirst({
        where: {
          id,
          archivedAt: null,
        },
      });
      if (!existingOrganization) {
        console.error(
          `[INCREMENT ERROR] Organization not found or archived: ${id}`,
        );
        throw new NotFoundException(
          `Organization with ID ${id} not found or is archived`,
        );
      }

      // Increment member count
      const updatedOrganization = await this.prisma.organization.update({
        where: { id },
        data: {
          totalMemberCount: {
            increment: 1,
          },
        },
      });

      console.log(
        `[INCREMENT SUCCESS] Member count incremented for organization: ${id}`,
      );
      return updatedOrganization;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        `[INCREMENT ERROR] Failed to increment member count: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to increment member count: ' + error.message,
      );
    }
  }

  /**
   * Decrements the member count for an organization.
   */
  async decrementMemberCount(id: string): Promise<IOrganization> {
    try {
      // Check if organization exists and is not archived
      const existingOrganization = await this.prisma.organization.findFirst({
        where: {
          id,
          archivedAt: null,
        },
      });
      if (!existingOrganization) {
        console.error(
          `[DECREMENT ERROR] Organization not found or archived: ${id}`,
        );
        throw new NotFoundException(
          `Organization with ID ${id} not found or is archived`,
        );
      }

      // Prevent negative member count
      if (existingOrganization.totalMemberCount <= 0) {
        console.error(
          `[DECREMENT ERROR] Cannot decrement member count below zero: ${id}`,
        );
        throw new BadRequestException(
          'Cannot decrement member count below zero',
        );
      }

      // Decrement member count
      const updatedOrganization = await this.prisma.organization.update({
        where: { id },
        data: {
          totalMemberCount: {
            decrement: 1,
          },
        },
      });

      console.log(
        `[DECREMENT SUCCESS] Member count decremented for organization: ${id}`,
      );
      return updatedOrganization;
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
        'Failed to decrement member count: ' + error.message,
      );
    }
  }

  /**
   * Finds all organizations for Super Owner administration with filtering and pagination.
   */
  async findAllForAdmin(filters: {
    name?: string;
    email?: string;
    limit: number;
    offset: number;
  }): Promise<{
    organizations: IOrganization[];
    total: number;
  }> {
    try {
      // Build where clause based on filters (excluding archived organizations)
      const whereClause: any = {
        archivedAt: null,
      };

      if (filters.name) {
        whereClause.name = {
          contains: filters.name,
          mode: 'insensitive',
        };
      }

      if (filters.email) {
        whereClause.email = {
          contains: filters.email,
          mode: 'insensitive',
        };
      }

      // Get total count for pagination
      const total = await this.prisma.organization.count({
        where: whereClause,
      });

      // Get organizations with pagination
      const organizations = await this.prisma.organization.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        take: filters.limit,
        skip: filters.offset,
      });

      console.log(
        `[FIND_ALL_ADMIN SUCCESS] Found ${organizations.length}/${total} organizations`,
      );

      return {
        organizations,
        total,
      };
    } catch (error) {
      console.error(
        `[FIND_ALL_ADMIN ERROR] Failed to find organizations for admin: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to find organizations for admin: ' + error.message,
      );
    }
  }
}
