# Suggested Development Commands

## Package Management
- `pnpm install` - Install dependencies
- `pnpm run build` - Build the application
- `pnpm run lint` - Run ESLint with auto-fix
- `pnpm run format` - Format code with Prettier

## Development
- `pnpm run start:dev` - Start development server with watch mode
- `pnpm run start:debug` - Start with debug mode and watch
- `pnpm run start:prod` - Start production server

## Testing
- `pnpm run test` - Run unit tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:cov` - Run tests with coverage
- `pnpm run test:e2e` - Run end-to-end tests

## Database
- `npx prisma generate` - Generate Prisma client (outputs to `generated/prisma`)
- `npx prisma migrate dev` - Run database migrations
- `npx prisma studio` - Open Prisma Studio
- `npx prisma migrate status` - Check migration status

## Docker
- `pnpm run docker:build` - Build Docker image
- `pnpm run docker:run` - Run in Docker container
- `pnpm run docker:up` - Start with docker-compose
- `pnpm run docker:down` - Stop docker-compose