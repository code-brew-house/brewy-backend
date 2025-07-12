# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important
- ALL instructions within this document MUST BE FOLLOWED, these are not optional unless explicitly stated.
- ASK FOR CLARIFICATION If you are uncertain of any of thing within the document.
- DO NOT edit more code than you have to.
- DO NOT WASTE TOKENS, be succinct and concise.
- ALWAYS USE MCPS WHERE APPLICABLE.

## MCP Servers
- Use Context7 when needing documentation beyond training cutoff
- Use Serena for Context Management and Searching Through Code, specially when debugging.

## Project Overview

This is a NestJS backend application for the Brewy Call Analytics App. The main functionality currently includes MP3 file upload to Cloudflare R2 storage with metadata persistence in a PostgreSQL database via Prisma ORM.

**Key Technologies:**
- NestJS framework (TypeScript)
- Prisma ORM with PostgreSQL database
- Cloudflare R2 for file storage (S3-compatible)
- AWS SDK for S3 operations
- Jest for testing

## Common Development Commands

**Package Management:**
- `pnpm install` - Install dependencies
- `pnpm run build` - Build the application
- `pnpm run lint` - Run ESLint with auto-fix
- `pnpm run format` - Format code with Prettier

**Development:**
- `pnpm run start:dev` - Start development server with watch mode
- `pnpm run start:debug` - Start with debug mode and watch
- `pnpm run start:prod` - Start production server

**Testing:**
- `pnpm run test` - Run unit tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:cov` - Run tests with coverage
- `pnpm run test:e2e` - Run end-to-end tests

**Database:**
- `npx prisma generate` - Generate Prisma client (outputs to `generated/prisma`)
- `npx prisma migrate dev` - Run database migrations
- `npx prisma studio` - Open Prisma Studio

## Architecture

**Module Structure:**
- `src/app.module.ts` - Root module with global configuration
- `src/modules/storage/` - Storage module handling R2 file operations
- `src/prisma/` - Prisma service for database operations
- `src/filters/` - Global exception filters

**Storage Module Architecture:**
- `StorageController` - REST endpoints for file operations
- `StorageService` - Business logic layer
- `R2StorageService` - Low-level R2/S3 operations
- `PrismaService` - Database access layer

**Database Schema:**
- `Storage` model with fields: id (UUID), url, filename, size, mimetype, timestamp

## Development Guidelines

**Code Style (from .cursor/rules/nestjs.mdc):**
- Use pnpm/pnpx instead of npm/npx
- Follow TypeScript strict typing (avoid `any`)
- Use JSDoc for public classes and methods
- PascalCase for classes, camelCase for variables/functions
- kebab-case for files and directories
- Functions should be short (<20 instructions) with single purpose
- Use SOLID principles and prefer composition over inheritance

**NestJS Patterns:**
- Modular architecture with one module per domain
- Use DTOs with class-validator for input validation
- One service per entity
- Include global exception filters
- Write smoke tests for all controllers

**File Upload Constraints:**
- MP3 files only (50MB max)
- Validates by MIME type and file extension
- Streams uploads to avoid memory issues

## Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct database connection (for migrations)
- `R2_BUCKET_NAME` - Cloudflare R2 bucket name
- `R2_ENDPOINT_URL` - R2 endpoint URL
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key

## API Endpoints

**Storage Operations:**
- `POST /storage/upload` - Upload MP3 file
- `GET /storage` - List all files
- `GET /storage/:id` - Get file by ID
- `PATCH /storage/:id` - Update file metadata
- `DELETE /storage/:id` - Delete file
- `GET /storage/:id/presigned-url` - Get presigned URL for file access

## Testing

- Unit tests for controllers and services
- E2E tests for API endpoints
- Tests follow Arrange-Act-Assert pattern
- Mock external dependencies (R2, database)
- Include smoke tests for each controller

## Important Notes

- Prisma client is generated to `generated/prisma` directory
- Application runs on port 3000 by default
- Global configuration is enabled for environment variables
- HTTP exception filter is applied globally to storage endpoints
- File uploads are streamed to handle large files efficiently