# Code Style and Conventions

## General Guidelines
- Use pnpm/pnpx instead of npm/npx
- Follow TypeScript strict typing (avoid `any`)
- Use JSDoc for public classes and methods
- Functions should be short (<20 instructions) with single purpose
- Use SOLID principles and prefer composition over inheritance

## Naming Conventions
- **PascalCase** for classes, interfaces, enums
- **camelCase** for variables, functions, methods
- **kebab-case** for files and directories
- **SCREAMING_SNAKE_CASE** for constants

## NestJS Patterns
- Modular architecture with one module per domain
- Use DTOs with class-validator for input validation
- One service per entity
- Include global exception filters
- Write comprehensive tests for all controllers and services

## File Structure
- Unit tests alongside source files (e.g., `service.ts` and `service.spec.ts`)
- E2E tests in `/test` directory
- DTOs in `/dto` subdirectory of each module
- Entities in `/entities` subdirectory
- Types in `/types` subdirectory

## Security Practices
- Validate all inputs using class-validator
- Sanitize user input to prevent XSS
- Use rate limiting for authentication endpoints
- Never log sensitive information like passwords
- Implement proper error handling without revealing system details