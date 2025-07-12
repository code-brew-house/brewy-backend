/**
 * DTO for organization responses that excludes sensitive fields
 */
export class OrganizationResponseDto {
  /** Organization ID */
  id: string;

  /** Organization name */
  name: string;

  /** Contact number */
  contactNumber: string;

  /** Email address */
  email: string;

  /** Total member count */
  totalMemberCount: number;

  /** Organization creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  constructor(partial: Partial<OrganizationResponseDto>) {
    Object.assign(this, partial);
  }
}
