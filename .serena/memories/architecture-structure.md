# Codebase Architecture and Structure

## Module Structure
- `src/app.module.ts` - Root module with global configuration
- `src/modules/` - Feature modules organized by domain
  - `auth/` - Authentication and authorization
  - `user/` - User management
  - `organization/` - Multi-tenant organization management
  - `storage/` - File storage (Cloudflare R2)
  - `audio-analysis/` - Audio processing and analysis
  - `jobs/` - Job tracking and management
  - `health/` - Health check endpoints

## Common Infrastructure
- `src/common/` - Shared utilities and infrastructure
  - `decorators/` - Custom parameter decorators
  - `filters/` - Exception filters
  - `guards/` - Authorization guards
  - `interceptors/` - Request/response interceptors
  - `middleware/` - Custom middleware
  - `services/` - Shared services
  - `types/` - Common type definitions
  - `utils/` - Utility functions

## Database
- `prisma/schema.prisma` - Database schema definition
- `prisma/migrations/` - Database migration files
- `generated/prisma/` - Generated Prisma client
- `src/prisma/prisma.service.ts` - Prisma service wrapper

## Testing
- Unit tests: `.spec.ts` files alongside source code
- Integration tests: `test/` directory with `.e2e-spec.ts` files
- Test data and mocks within test files

## Key Patterns
- All modules follow NestJS conventions with module/controller/service pattern
- DTOs for request/response validation using class-validator
- Entity classes for data models
- Separation of business logic in services
- Guards for authentication and authorization
- Proper error handling with custom filters