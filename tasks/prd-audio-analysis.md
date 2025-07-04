# PRD: Audio Analysis Feature

## Introduction/Overview

This feature enables users to upload MP3 audio files for automated analysis through Assembly AI. The system will handle file uploads, store them in R2 storage, trigger asynchronous processing via N8N workflows, and track the entire operation through a jobs system. The analysis results will be stored in the database and made accessible through API endpoints.

## Goals

1. Enable secure MP3 file upload with validation (format and size)
2. Implement a generic, reusable storage service for all file types
3. Create a job tracking system to monitor audio analysis operations
4. Integrate with N8N workflows for asynchronous audio processing
5. Store and retrieve audio analysis results (transcript, sentiment)
6. Provide clear API endpoints for upload, status checking, and result retrieval

## User Stories

1. **As a user**, I want to upload an MP3 file so that it can be analyzed for transcript and sentiment
2. **As a user**, I want to check the status of my audio analysis job so that I know when processing is complete
3. **As a user**, I want to retrieve the analysis results so that I can view the transcript and sentiment data
4. **As a system**, I want to track all processing jobs so that I can handle failures and provide status updates
5. **As a developer**, I want a generic storage service so that I can easily add support for other file types in the future

## Functional Requirements

### 1. Audio Analysis Module Creation
- Create new `AudioAnalysisModule` with all required dependencies
- Register module in `AppModule`
- Include proper imports for storage, jobs, and webhook services

### 2. Audio Upload Endpoint (`POST /audio-analysis/upload`)
- Accept single MP3 file uploads
- Validate file format (must be MP3)
- Validate file size (maximum 20MB)
- Return immediate success response with job ID
- Handle upload errors gracefully

### 3. Generic Storage Service Refactoring
- Remove file type-specific validation from StorageService
- Make StorageService accept all file types
- Maintain core functionality: upload to R2, save metadata to database
- Remove existing storage endpoints (breaking change acceptable)

### 4. Jobs Entity and Service
- Create new Jobs entity with Prisma schema:
  - id (UUID)
  - status (enum: pending, processing, completed, failed)
  - fileId (reference to Storage entity)
  - createdAt (timestamp)
  - updatedAt (timestamp)
  - startedAt (timestamp, nullable)
  - completedAt (timestamp, nullable)
  - error (text, nullable)
- Create JobsService for job management operations
- Create job record immediately after successful file upload
- Update job status based on processing events

### 5. Audio Analysis Service
- Create AudioAnalysisService as main business logic handler
- Coordinate between file upload, job creation, and N8N trigger
- Handle file validation specific to audio files
- Manage the complete audio analysis workflow

### 6. N8N Workflow Integration
- Trigger N8N webhook asynchronously after file upload
- Send file URL and job ID to N8N
- Receive immediate success/fail response from N8N
- If trigger fails, keep job in "pending" status

### 7. Webhook Endpoint for N8N Updates (`POST /audio-analysis/webhook`)
- Receive status updates from N8N workflow
- Update job status based on N8N response
- Store analysis results when processing completes
- Handle failure notifications

### 8. Analysis Results Storage
- Create new AnalysisResult entity with Prisma schema:
  - id (UUID)
  - jobId (reference to Jobs entity)
  - transcript (text)
  - sentiment (text/JSON)
  - metadata (JSON, for additional Assembly AI data)
  - createdAt (timestamp)
- Create AnalysisResultsService for results management

### 9. Job Status Endpoint (`GET /audio-analysis/jobs/:jobId`)
- Return current job status
- Include basic job metadata
- Return 404 if job not found

### 10. Analysis Results Endpoint (`GET /audio-analysis/jobs/:jobId/results`)
- Return analysis results if job is completed
- Return appropriate error if job is not completed or failed
- Include transcript and sentiment data

### 11. DTOs and Validation
- Create upload DTOs for file validation
- Create response DTOs for consistent API responses
- Create webhook DTOs for N8N communication
- Implement proper validation using class-validator

## Non-Goals (Out of Scope)

1. User authentication and authorization (jobs not linked to users initially)
2. Real-time status updates via WebSockets or SSE
3. Batch file uploads
4. Support for audio formats other than MP3
5. Job progress tracking (percentage complete)
6. Versioning of analysis results
7. Retry logic for failed N8N workflows
8. File preview or playback functionality

## Design Considerations

- API responses should follow RESTful conventions
- Error messages should be clear and actionable
- Use appropriate HTTP status codes
- Maintain consistent response format across endpoints
- Follow existing NestJS patterns in the codebase

## Technical Considerations

### 1. Module Structure
- Create new `AudioAnalysisModule` for all audio-related functionality
- Create `AudioAnalysisController` for API endpoints
- Create `AudioAnalysisService` for business logic
- Create `JobsService` for job management
- Create `AnalysisResultsService` for results management
- Refactor `StorageService` to be generic

### 2. Database Migrations
- Add Jobs table to Prisma schema
- Add AnalysisResults table to Prisma schema
- Update relationships between entities
- Generate and run migrations

### 3. Environment Variables
- Add N8N webhook URL configuration
- Add webhook secret/authentication token if needed

### 4. Error Handling
- Implement proper error handling for file upload failures
- Handle N8N webhook trigger failures
- Validate webhook requests from N8N
- Apply global exception filters

### 5. File Access
- Ensure uploaded files are accessible by N8N workflow
- Use presigned URLs for secure file access

### 6. Services and Dependencies
- AudioAnalysisService depends on StorageService, JobsService
- JobsService depends on PrismaService
- AnalysisResultsService depends on PrismaService, JobsService
- Proper dependency injection setup

## Success Metrics

1. Successfully upload and process 95% of valid MP3 files
2. Average job completion time under 5 minutes
3. Zero data loss for completed analysis results
4. API response time under 500ms for status checks
5. Successful integration with N8N workflows without manual intervention

## Implementation Tasks

1. **Database Schema Updates**
   - Add Jobs model to Prisma schema
   - Add AnalysisResults model to Prisma schema
   - Create and run database migrations

2. **Service Layer Creation**
   - Create JobsService with CRUD operations
   - Create AnalysisResultsService with CRUD operations
   - Create AudioAnalysisService with workflow orchestration
   - Refactor StorageService to remove file type restrictions

3. **Module and Controller Setup**
   - Create AudioAnalysisModule
   - Create AudioAnalysisController with all endpoints
   - Register module in AppModule

4. **DTOs and Validation**
   - Create upload request/response DTOs
   - Create job status response DTOs
   - Create webhook request DTOs
   - Create analysis results response DTOs

5. **Integration and Testing**
   - Implement N8N webhook integration
   - Add unit tests for all services
   - Add e2e tests for API endpoints
   - Test complete workflow end-to-end

## Open Questions

1. Should we implement webhook authentication/verification for N8N callbacks?
2. What specific Assembly AI features should be enabled (speaker diarization, language detection, etc.)?
3. Should we set a job expiration/cleanup policy?
4. Do we need to handle duplicate file uploads?
5. Should failed jobs be automatically retried after a certain period?
6. What level of detail should be included in error messages for failed jobs?
7. Should we implement rate limiting for upload endpoints?