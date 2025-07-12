import { ForbiddenException, BadRequestException } from '@nestjs/common';

/**
 * Base class for organization limit exceptions
 */
export abstract class OrganizationLimitException extends ForbiddenException {
  constructor(
    message: string,
    public readonly organizationId: string,
    public readonly limitType: string,
    public readonly currentCount: number,
    public readonly maxLimit: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  /**
   * Returns a structured error object with additional context
   */
  getErrorDetails() {
    return {
      error: this.name,
      message: this.message,
      organizationId: this.organizationId,
      limitType: this.limitType,
      currentCount: this.currentCount,
      maxLimit: this.maxLimit,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Exception thrown when an organization exceeds its maximum user limit
 */
export class UserLimitExceededException extends OrganizationLimitException {
  constructor(organizationId: string, currentCount: number, maxLimit: number) {
    const message = `Organization has reached its maximum user limit of ${maxLimit}. Current count: ${currentCount}`;
    super(message, organizationId, 'users', currentCount, maxLimit);
  }
}

/**
 * Exception thrown when an organization exceeds its maximum concurrent job limit
 */
export class ConcurrentJobLimitExceededException extends OrganizationLimitException {
  constructor(organizationId: string, currentCount: number, maxLimit: number) {
    const message = `Organization has reached its maximum concurrent job limit of ${maxLimit}. Current active jobs: ${currentCount}. Please wait for existing jobs to complete.`;
    super(message, organizationId, 'concurrent_jobs', currentCount, maxLimit);
  }
}

/**
 * Exception thrown when organization limits configuration is invalid
 */
export class InvalidOrganizationLimitsException extends BadRequestException {
  constructor(
    public readonly organizationId: string,
    public readonly invalidField: string,
    public readonly providedValue: any,
    public readonly reason: string,
  ) {
    const message = `Invalid organization limit configuration for ${invalidField}: ${reason}. Provided value: ${providedValue}`;
    super(message);
    this.name = this.constructor.name;
  }

  /**
   * Returns a structured error object with additional context
   */
  getErrorDetails() {
    return {
      error: this.name,
      message: this.message,
      organizationId: this.organizationId,
      invalidField: this.invalidField,
      providedValue: this.providedValue,
      reason: this.reason,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Exception thrown when an organization is not found during limit validation
 */
export class OrganizationNotFoundForLimitException extends BadRequestException {
  constructor(public readonly organizationId: string) {
    const message = `Organization with ID ${organizationId} not found for limit validation`;
    super(message);
    this.name = this.constructor.name;
  }

  /**
   * Returns a structured error object with additional context
   */
  getErrorDetails() {
    return {
      error: this.name,
      message: this.message,
      organizationId: this.organizationId,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Utility class for creating organization limit exceptions
 */
export class OrganizationLimitExceptionFactory {
  /**
   * Creates a user limit exceeded exception
   */
  static createUserLimitExceeded(
    organizationId: string,
    currentCount: number,
    maxLimit: number,
  ): UserLimitExceededException {
    return new UserLimitExceededException(
      organizationId,
      currentCount,
      maxLimit,
    );
  }

  /**
   * Creates a concurrent job limit exceeded exception
   */
  static createConcurrentJobLimitExceeded(
    organizationId: string,
    currentCount: number,
    maxLimit: number,
  ): ConcurrentJobLimitExceededException {
    return new ConcurrentJobLimitExceededException(
      organizationId,
      currentCount,
      maxLimit,
    );
  }

  /**
   * Creates an invalid limits configuration exception
   */
  static createInvalidLimits(
    organizationId: string,
    invalidField: string,
    providedValue: any,
    reason: string,
  ): InvalidOrganizationLimitsException {
    return new InvalidOrganizationLimitsException(
      organizationId,
      invalidField,
      providedValue,
      reason,
    );
  }

  /**
   * Creates an organization not found exception
   */
  static createOrganizationNotFound(
    organizationId: string,
  ): OrganizationNotFoundForLimitException {
    return new OrganizationNotFoundForLimitException(organizationId);
  }
}
