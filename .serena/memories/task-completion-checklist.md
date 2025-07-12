# Task Completion Checklist

## When a task is completed, always run:

### 1. Code Quality
- `pnpm run lint` - Run ESLint with auto-fix
- `pnpm run format` - Format code with Prettier
- `pnpm run build` - Ensure application builds successfully

### 2. Testing
- `pnpm run test` - Run unit tests
- `pnpm run test:e2e` - Run end-to-end tests
- `pnpm run test:cov` - Check test coverage

### 3. Database (if schema changes)
- `npx prisma generate` - Regenerate Prisma client
- `npx prisma migrate dev` - Apply database migrations
- Verify migration works in development environment

### 4. Security Validation
- Ensure all new endpoints have proper authentication guards
- Verify input validation on all DTOs
- Check that organization-based data isolation is maintained
- Review for any sensitive data exposure

### 5. Documentation
- Update CLAUDE.md if new commands or patterns are introduced
- Add JSDoc comments to public methods
- Update API documentation if endpoints are added/modified

### 6. Integration
- Verify the feature works end-to-end
- Test with realistic data
- Ensure existing functionality is not broken