import {
  PaginationQueryDto,
  PaginatedResponseDto,
} from '../../../common/dto/pagination.dto';
import { AnalysisResultsDto } from './analysis-results.dto';
import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * Query DTO for listing analysis results with pagination and sorting
 */
export class ListAnalysisResultsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['createdAt'], { message: 'Sort field must be one of: createdAt' })
  sortBy?: string = 'createdAt';
}

/**
 * Response DTO for paginated analysis results
 */
export class ListAnalysisResultsDto extends PaginatedResponseDto<AnalysisResultsDto> {
  constructor(
    data: AnalysisResultsDto[],
    total: number,
    page: number,
    limit: number,
  ) {
    super(data, total, page, limit);
  }
}
