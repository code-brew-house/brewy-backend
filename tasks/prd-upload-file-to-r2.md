# Product Requirements Document: Upload File to Cloudflare R2

## 1. Introduction/Overview
This feature enables end users of the Call Analytics App to upload MP3 files to Cloudflare R2 Storage. These files will be used for analytics and audit purposes. The system will store the file URL and upload timestamp in a Supabase (Postgres) database using Prisma ORM. The feature will expose a backend API for file management.

## 2. Goals
- Allow end users to upload MP3 files (max 50MB) via API.
- Store uploaded files in Cloudflare R2 Storage.
- Save file URL and upload timestamp in Supabase (Postgres) using Prisma.
- Provide full CRUD operations for uploaded files.
- Provide presigned URLs for secure file access.
- Follow NestJS best practices for architecture.

## 3. User Stories
- As an end user, I want to upload an MP3 file so that it can be analyzed and stored for audit purposes.
- As an end user, I want to retrieve a list of my uploaded files so I can review them.
- As an end user, I want to update or delete an uploaded file if needed.
- As an end user, I want to get a presigned URL to securely access my uploaded file.

## 4. Functional Requirements
1. The system must accept file uploads via a REST API endpoint.
2. The system must restrict uploads to MP3 files only (by MIME type and/or file extension).
3. The system must reject files larger than 50MB.
4. The system must upload files to Cloudflare R2 Storage.
5. The system must store the file URL and upload timestamp in Supabase (Postgres) using Prisma ORM.
6. The system must provide API endpoints for:
    - Creating (uploading) a file
    - Reading (listing and retrieving) files
    - Updating file metadata (future extensibility)
    - Deleting files
    - Generating presigned URLs for file access
7. The system must handle and return appropriate errors for unsupported file types, oversized files, and storage/network issues.
8. The system must be backend-only and accessible via API (no UI).

## 5. Non-Goals (Out of Scope)
- No authentication or authorization (to be added later).
- No support for file types other than MP3 (for now).
- No frontend or UI components.
- No analytics processing (upload and storage only).

## 6. Design Considerations (Optional)
- API should follow RESTful conventions.
- File storage paths in R2 should be unique and organized (e.g., by user or timestamp).
- Error responses should be clear and actionable.

## 7. Technical Considerations (Optional)
- Use NestJS modular architecture and best practices.
- Use Prisma ORM for all database interactions.
- Use Supabase as the Postgres provider.
- Integrate with Cloudflare R2 using their official SDK or S3-compatible APIs.
- Ensure file uploads are streamed to avoid memory issues with large files.
- Prepare for future extensibility (e.g., support for more file types, metadata, auth).

## 8. Success Metrics
- 95%+ of valid uploads succeed on first attempt.
- 100% of uploaded files have correct URL and timestamp in the database.
- All CRUD and presigned URL endpoints function as expected (verified by tests).
- System rejects all invalid file types and files over 50MB.

## 9. Open Questions
- Should there be a limit on the number of files a user can upload?
- Should duplicate file uploads (same content) be detected or allowed?
- What is the expected retention period for uploaded files?
- Should there be support for batch uploads in the future? 