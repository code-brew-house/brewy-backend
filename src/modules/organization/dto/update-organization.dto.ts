import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

/**
 * DTO for updating an organization using PartialType from CreateOrganizationDto
 * All fields from CreateOrganizationDto are optional for updates
 */
export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
