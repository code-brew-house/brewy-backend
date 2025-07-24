# Multi-stage build for NestJS application
FROM node:22-alpine AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package.json and pnpm-lock.yaml to the working directory
COPY package*.json pnpm-lock.yaml ./

# Install the application dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Copy .env file for build-time environment variables
COPY .env.example .env

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS application
RUN pnpm run build

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/main"]