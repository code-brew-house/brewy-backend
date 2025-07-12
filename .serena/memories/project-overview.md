# Brewy Backend - Project Overview

## Purpose
Brewy is a multi-tenant B2B SaaS platform for call analytics. It processes MP3 audio files through Assembly AI for transcription and sentiment analysis, supporting multiple organizations with complete data isolation.

## Tech Stack
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **Authentication**: JWT with bcrypt password hashing
- **Testing**: Jest (unit, integration, e2e)
- **Audio Processing**: Assembly AI via N8N workflows
- **Scheduling**: @nestjs/schedule for cron jobs

## Key Features
- Multi-tenant organization management with role-based access control
- Secure user authentication and registration
- MP3 file upload and storage with metadata persistence
- Asynchronous audio analysis with job tracking
- Complete data isolation between organizations
- Rate limiting and security middleware