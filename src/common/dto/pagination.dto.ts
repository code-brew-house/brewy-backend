import { Type } from 'class-transformer';
import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
  IsIn,
} from 'class-validator';

/**
 * Base DTO for pagination query parameters
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'Sort order must be either asc or desc' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Metadata for paginated responses
 */
export class PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Generic paginated response DTO
 */
export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMetaDto;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }
}
