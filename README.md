<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).

## Environment Variables

- `N8N_WEBHOOK_URL`: The URL for the N8N webhook endpoint. Required for audio analysis workflow integration.
- `N8N_WEBHOOK_SECRET`: (Optional) Secret token for authenticating incoming N8N webhook requests. Set this if your N8N workflow requires a secret for security.

## API Documentation

### Organization Management Endpoints

The Brewy backend supports multi-tenant organization management with role-based access control.

#### Authentication

All organization endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### Organization Roles

- **SUPER_OWNER**: Can manage all organizations across the system
- **OWNER**: Can manage their own organization and all users within it
- **ADMIN**: Can manage users within their organization (limited to AGENT creation)
- **AGENT**: Basic user with access to organization resources

#### Organization Endpoints

##### Create Organization
```http
POST /organizations
Content-Type: application/json

{
  "name": "Tech Solutions Inc",
  "email": "contact@techsolutions.com",
  "contactNumber": "+1-555-123-4567"
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Tech Solutions Inc",
  "email": "contact@techsolutions.com",
  "contactNumber": "+1-555-123-4567",
  "totalMemberCount": 0,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

##### Get All Organizations
```http
GET /organizations
# Optional query parameters:
# ?name=tech&email=contact@
```

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Tech Solutions Inc",
    "email": "contact@techsolutions.com",
    "contactNumber": "+1-555-123-4567",
    "totalMemberCount": 5,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
]
```

##### Get Organization by ID
```http
GET /organizations/{id}
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Tech Solutions Inc",
  "email": "contact@techsolutions.com",
  "contactNumber": "+1-555-123-4567",
  "totalMemberCount": 5,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

##### Update Organization
```http
PATCH /organizations/{id}
Content-Type: application/json

{
  "name": "Tech Solutions LLC",
  "contactNumber": "+1-555-123-9999"
}
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Tech Solutions LLC",
  "email": "contact@techsolutions.com",
  "contactNumber": "+1-555-123-9999",
  "totalMemberCount": 5,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T13:00:00.000Z"
}
```

##### Delete Organization (Soft Delete)
```http
DELETE /organizations/{id}
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Tech Solutions LLC",
  "email": "contact@techsolutions.com",
  "contactNumber": "+1-555-123-9999",
  "totalMemberCount": 5,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T13:00:00.000Z"
}
```

##### Add User to Organization (Super Owner Only)
```http
POST /organizations/{id}/users
Content-Type: application/json
Authorization: Bearer <super-owner-jwt-token>

{
  "username": "johndoe",
  "email": "john.doe@techsolutions.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe",
  "role": "OWNER"
}
```

**Response (201 Created):**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "username": "johndoe",
  "email": "john.doe@techsolutions.com",
  "fullName": "John Doe",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "OWNER",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

##### Get All Organizations (Super Owner Admin View)
```http
GET /organizations/admin
Authorization: Bearer <super-owner-jwt-token>
# Optional query parameters:
# ?name=tech&email=contact&limit=10&offset=0
```

**Response (200 OK):**
```json
{
  "organizations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Tech Solutions Inc",
      "email": "contact@techsolutions.com",
      "contactNumber": "+1-555-123-4567",
      "totalMemberCount": 5,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

#### Organization Limits

Each organization has configurable limits:

- **maxUsers**: Maximum number of users (default: 10)
- **maxConcurrentJobs**: Maximum concurrent audio analysis jobs (default: 5)

These limits are enforced when:
- Creating new users in the organization
- Starting new audio analysis jobs

#### Multi-tenant Data Isolation

The API ensures complete data isolation between organizations:

- Users can only access data from their own organization
- Storage files are filtered by organization
- Audio analysis jobs and results are organization-scoped
- Super Owners can access data across all organizations

#### Subdomain-based Organization Context

The API supports subdomain-based organization resolution:

```http
X-Organization-Subdomain: techsolutions
```

When this header is provided, the API will resolve the organization context based on the subdomain.

#### Error Responses

All endpoints return standardized error responses:

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["name must be at least 2 characters long"],
  "error": "Bad Request"
}
```

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Authentication required",
  "error": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions for this operation",
  "error": "Forbidden"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Organization with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

**409 Conflict:**
```json
{
  "statusCode": 409,
  "message": "Organization with this email already exists",
  "error": "Conflict"
}
```

**429 Too Many Requests:**
```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "error": "Too Many Requests"
}
```

#### Rate Limiting

All organization endpoints are subject to rate limiting:
- Standard endpoints: 100 requests per minute per IP
- Admin endpoints: 50 requests per minute per IP

### Integration with Other Modules

#### User Management
- Users are scoped to organizations
- Role-based user creation (ADMIN can only create AGENT users)
- Automatic organization member count management

#### Audio Analysis
- All audio files and analysis jobs are organization-scoped
- Concurrent job limits enforced per organization
- Analysis results isolated by organization

#### Storage
- File uploads are automatically tagged with organization context
- Storage quotas and limits can be configured per organization
- Presigned URLs respect organization boundaries

### Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Role-based access control enforced at controller and service levels
3. **Data Isolation**: Complete separation of data between organizations
4. **Input Validation**: Comprehensive validation on all input fields
5. **Rate Limiting**: Protection against abuse and DoS attacks
6. **Audit Logging**: All organization operations are logged for security auditing
