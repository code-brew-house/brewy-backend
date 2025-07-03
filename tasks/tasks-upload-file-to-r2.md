## Relevant Files

- `src/modules/storage/storage.module.ts` - NestJS module definition for storage management.
- `src/modules/storage/storage.service.ts` - Service containing business logic for storage CRUD and R2 integration.
- `src/modules/storage/storage.controller.ts` - Controller exposing REST API endpoints for storage operations.
- `src/modules/storage/dto/create-storage.dto.ts` - DTO for storage upload requests.
- `src/modules/storage/dto/update-storage.dto.ts` - DTO for updating storage metadata.
- `src/modules/storage/entities/storage.entity.ts` - TypeScript entity/model for storage records.
- `src/modules/storage/r2-storage.service.ts` - Service utility for Cloudflare R2 file operations.
- `src/modules/storage/r2-storage.service.spec.ts` - Integration test for R2 storage service.
- `prisma/schema.prisma` - Prisma schema for storage table definition.
- `src/modules/storage/storage.service.spec.ts` - Unit tests for storage service.
- `src/modules/storage/storage.controller.spec.ts` - Unit tests for storage controller.
- `test/storage.e2e-spec.ts` - End-to-end tests for storage API endpoints.
- `prisma/migrations/20250703010617_create_storage_table/` - Migration files for creating the storage table.
- `generated/prisma` - Generated Prisma client code.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `storage.service.ts` and `storage.service.spec.ts` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Set up database schema and Prisma models for storage records
  - [x] 1.1 Design the storage table schema in `prisma/schema.prisma` (fields: id, url, timestamp, etc.)
  - [x] 1.2 Generate and apply Prisma migration for the storage table
  - [x] 1.3 Create the `Storage` entity/model in `src/modules/storage/entities/storage.entity.ts`
  - [x] 1.4 Update Prisma client and test DB connection

- [x] 2.0 Integrate Cloudflare R2 storage and configure S3-compatible SDK
  - [x] 2.1 Set up Cloudflare R2 bucket and obtain credentials
  - [x] 2.2 Install and configure AWS S3 SDK (or Cloudflare SDK) in the project
  - [x] 2.3 Create a service utility for R2 file upload, download, delete, and presigned URL generation
  - [x] 2.4 Test R2 integration with sample file upload/download

- [x] 3.0 Implement NestJS module, service, and controller for storage CRUD and presigned URL APIs
  - [x] 3.1 Scaffold `storage.module.ts`, `storage.service.ts`, and `storage.controller.ts`
  - [x] 3.2 Implement storage upload endpoint (POST) with streaming to R2 and DB record creation
  - [x] 3.3 Implement storage list/retrieve endpoints (GET)
  - [x] 3.4 Implement storage update endpoint (PATCH/PUT) for metadata
  - [x] 3.5 Implement storage delete endpoint (DELETE) with R2 and DB cleanup
  - [x] 3.6 Implement endpoint for generating presigned URLs (GET)

- [x] 4.0 Add file validation, error handling, and streaming upload logic
  - [x] 4.1 Validate file type (MP3) and size (<=50MB) in upload endpoint
  - [x] 4.2 Handle and return errors for invalid files, oversized uploads, and storage/network issues
  - [x] 4.3 Ensure file uploads are streamed to R2 to avoid memory issues
  - [x] 4.4 Add logging for upload, download, and error events

- [x] 5.0 Write unit and integration tests for all endpoints and services
  - [x] 5.1 Write unit tests for storage service (`storage.service.spec.ts`)
  - [x] 5.2 Write unit tests for storage controller (`storage.controller.spec.ts`)
  - [x] 5.3 Write end-to-end tests for storage API endpoints (`test/storage.e2e-spec.ts`)
  - [x] 5.4 Add test cases for error handling and edge cases (invalid type, size, network errors) 