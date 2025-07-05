# Tasks: Audio Analysis Feature

## Relevant Files

- `prisma/schema.prisma` - Database schema definition with new Jobs and AnalysisResults models
- `src/modules/storage/storage.service.ts` - Refactored generic storage service without file type restrictions
- `src/modules/audio-analysis/audio-analysis.module.ts` - New module for audio analysis functionality
- `src/modules/audio-analysis/audio-analysis.controller.ts` - Controller with upload, status, and results endpoints
- `src/modules/audio-analysis/audio-analysis.service.ts` - Main business logic service for audio analysis workflow
- `src/modules/audio-analysis/jobs.service.ts` - Service for job management operations
- `src/modules/audio-analysis/analysis-results.service.ts` - Service for managing analysis results
- `src/modules/audio-analysis/dto/upload-audio.dto.ts` - DTO for audio file upload validation
- `src/modules/audio-analysis/dto/job-status.dto.ts` - DTO for job status responses
- `src/modules/audio-analysis/dto/webhook.dto.ts` - DTO for N8N webhook requests
- `src/modules/audio-analysis/dto/analysis-results.dto.ts` - DTO for analysis results responses
- `src/modules/audio-analysis/entities/job.entity.ts` - Job entity definition
- `src/modules/audio-analysis/entities/analysis-result.entity.ts` - Analysis result entity definition
- `src/app.module.ts` - Root module registration for AudioAnalysisModule
- `src/modules/audio-analysis/audio-analysis.controller.spec.ts` - Unit tests for controller with comprehensive endpoint coverage
- `src/modules/audio-analysis/audio-analysis.service.spec.ts` - Unit tests for audio analysis service
- `src/modules/audio-analysis/jobs.service.spec.ts` - Unit tests for jobs service
- `src/modules/audio-analysis/analysis-results.service.spec.ts` - Unit tests for analysis results service
- `src/modules/audio-analysis/audio-analysis.integration.spec.ts` - Integration tests for all API endpoints
- `test/audio-analysis.e2e-spec.ts` - Comprehensive end-to-end tests for complete audio analysis workflow
- `README.md` - Documents required environment variables N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET for N8N integration
- `src/modules/audio-analysis/n8n-webhook.service.ts` - Improved error handling for N8N webhook response (logs and throws on non-2xx)
- `src/modules/audio-analysis/n8n-webhook.service.spec.ts` - Comprehensive unit tests for N8N webhook service with mock responses
- `src/modules/audio-analysis/database-relationships.spec.ts` - Database relationship and constraint validation tests with real database interactions

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `pnpm run test` to run all tests, or `pnpm run test:watch` for watch mode
- Use `npx prisma migrate dev` to create and apply database migrations
- Use `npx prisma generate` to regenerate Prisma client after schema changes

## Tasks

- [x] 1.0 Database Schema and Model Updates
  - [x] 1.1 Add Jobs model to Prisma schema with all required fields (id, status, fileId, timestamps, error)
  - [x] 1.2 Add AnalysisResults model to Prisma schema with fields (id, jobId, transcript, sentiment, metadata, createdAt)
  - [x] 1.3 Define proper relationships between Jobs, AnalysisResults, and Storage entities
  - [x] 1.4 Create enum for job status (pending, processing, completed, failed)
  - [x] 1.5 Generate and run database migration using `npx prisma migrate dev`
  - [x] 1.6 Regenerate Prisma client using `npx prisma generate`

- [x] 2.0 Storage Service Refactoring
  - [x] 2.1 Remove MP3-specific file type validation from StorageService
  - [x] 2.2 Remove file extension validation from StorageService
  - [x] 2.3 Make StorageService accept any file type for generic usage
  - [x] 2.4 Keep core functionality intact (R2 upload, metadata persistence)
  - [x] 2.5 Remove existing storage endpoints from StorageController (breaking change)
  - [x] 2.6 Update StorageService tests to reflect generic file handling

- [x] 3.0 Audio Analysis Module and Services Implementation
  - [x] 3.1 Create AudioAnalysisModule with proper imports and providers
  - [x] 3.2 Create Job entity class with Prisma decorators and validation
  - [x] 3.3 Create AnalysisResult entity class with Prisma decorators and validation
  - [x] 3.4 Create JobsService with CRUD operations (create, findById, updateStatus, findAll)
  - [x] 3.5 Create AnalysisResultsService with CRUD operations (create, findByJobId, findById)
  - [x] 3.6 Create AudioAnalysisService with workflow orchestration methods
  - [x] 3.7 Implement file upload validation in AudioAnalysisService (MP3 format, 20MB limit)
  - [x] 3.8 Implement job creation logic in AudioAnalysisService
  - [x] 3.9 Implement N8N webhook trigger logic in AudioAnalysisService
  - [x] 3.10 Register AudioAnalysisModule in AppModule

- [x] 4.0 API Endpoints and Controller Development
  - [x] 4.1 Create AudioAnalysisController with proper decorators and imports
  - [x] 4.2 Create upload DTOs (UploadAudioDto) with file validation decorators
  - [x] 4.3 Create response DTOs (JobStatusDto, AnalysisResultsDto) for consistent API responses
  - [x] 4.4 Create webhook DTOs (WebhookDto) for N8N communication
  - [x] 4.5 Implement POST /audio-analysis/upload endpoint with file validation
  - [x] 4.6 Implement GET /audio-analysis/jobs/:jobId endpoint for job status
  - [x] 4.7 Implement GET /audio-analysis/jobs/:jobId/results endpoint for analysis results
  - [x] 4.8 Implement POST /audio-analysis/webhook endpoint for N8N callbacks
  - [x] 4.9 Add proper error handling and HTTP status codes for all endpoints
  - [x] 4.10 Add proper validation pipes and guards for all endpoints

- [x] 5.0 N8N Integration and Webhook Implementation
  - [x] 5.1 Add N8N webhook URL to environment variables
  - [x] 5.2 Add webhook secret/authentication token to environment variables if needed
  - [x] 5.3 Implement HTTP client service for N8N webhook calls
  - [x] 5.4 Create webhook payload structure with file URL and job ID
  - [x] 5.5 Implement asynchronous webhook trigger after successful file upload
  - [x] 5.6 Implement webhook response handling (success/failure)
  - [x] 5.7 Implement webhook endpoint to receive N8N status updates
  - [x] 5.8 Implement job status update logic based on N8N callbacks
  - [x] 5.9 Implement analysis results storage when processing completes
  - [x] 5.10 Implement error handling for failed N8N workflow triggers
  - [x] 5.11 Implement webhook validation/authentication if security is required

- [x] 6.0 Testing and Validation
  - [x] 6.1 Create unit tests for JobsService with mock PrismaService
  - [x] 6.2 Create unit tests for AnalysisResultsService with mock PrismaService
  - [x] 6.3 Create unit tests for AudioAnalysisService with mock dependencies
  - [x] 6.4 Create unit tests for AudioAnalysisController with mock services
  - [x] 6.5 Create integration tests for all API endpoints
  - [x] 6.6 Create end-to-end tests for complete audio analysis workflow
  - [x] 6.7 Test file upload validation (format, size limits)
  - [x] 6.8 Test job status tracking and updates
  - [x] 6.9 Test N8N webhook integration (mock N8N responses)
  - [x] 6.10 Test error handling for various failure scenarios
  - [x] 6.11 Test database relationships and constraints
  - [x] 6.12 Run all tests with coverage reporting using `pnpm run test:cov`