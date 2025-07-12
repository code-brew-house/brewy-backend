# Product Requirements Document: Organization Feature

## Introduction/Overview

The Organization feature introduces a multi-tenant architecture to the Brewy Call Analytics platform, enabling the system to support multiple business entities (organizations) within a single application instance. Each organization operates as an isolated environment with its own users, data, and settings. This feature establishes a hierarchical permission system where a Super Owner manages all organizations, while each organization has its own internal hierarchy of Business Owners, Admins, and Agents.

The primary problem this solves is enabling Brewy to scale from a single-business application to a multi-business SaaS platform, where each organization's data is completely isolated and secure from others.

## Goals

1. **Multi-Tenancy Support**: Enable the platform to host multiple independent organizations with complete data isolation
2. **Hierarchical Access Control**: Implement role-based permissions (SUPER_OWNER, OWNER, ADMIN, AGENT) with clearly defined access boundaries
3. **Organization Management**: Provide Super Owner capabilities to create and manage organizations
4. **Data Security**: Ensure complete data isolation between organizations with no cross-organization data leakage
5. **Scalable Architecture**: Design the system to support growth from tens to thousands of organizations

## User Stories

### Super Owner Stories
- As a **Super Owner**, I want to create new organizations so that I can onboard new business customers
- As a **Super Owner**, I want to add the first Owner to a new organization so that they can manage their business
- As a **Super Owner**, I want to access any organization's data via API so that I can provide platform-level support
- As a **Super Owner**, I want to list all organizations so that I can monitor platform usage

### Business Owner Stories
- As an **Owner**, I want to manage my organization's users via API so that I can control access to our data
- As an **Owner**, I want to retrieve all data within my organization so that I can monitor business operations
- As an **Owner**, I want to configure organization settings like user limits so that I can manage resources

### Admin Stories
- As an **Admin**, I want to add new Agents to the organization via API so that we can scale our team
- As an **Admin**, I want to retrieve analytics data via API so that I can monitor team performance
- As an **Admin**, I cannot modify organization settings so that critical configurations remain protected

### Agent Stories
- As an **Agent**, I want to access only my own audio analyses and jobs via API so that I can focus on my work
- As an **Agent**, I want to upload audio files for analysis so that I can process customer calls
- As an **Agent**, I cannot see other agents' data so that privacy is maintained

## Functional Requirements

### Organization Management
1. The system must support multiple isolated organizations within a single application instance
2. Each organization must have a unique subdomain identifier (e.g., acme)
3. Organizations must have the following properties:
   - Unique ID (UUID)
   - Name (required, string)
   - Contact Number (required, string)
   - Email (required, unique, valid email format)
   - Total Member Count (stored and updated via application logic)
   - Timestamps (created, updated)

### User Management & Roles
4. The system must support four user roles: SUPER_OWNER, OWNER, ADMIN, AGENT
5. Each user must belong to exactly one organization (except SUPER_OWNER who has global access)
6. User role permissions must be enforced as follows:
   - **SUPER_OWNER**: Full access to all organizations and data
   - **OWNER**: Full access to their organization only
   - **ADMIN**: Can add agents and view all organization data (read-only for settings)
   - **AGENT**: Can only view and manage their own data

### Organization Creation Flow
7. Only SUPER_OWNER can create new organizations via dedicated API endpoint
8. When creating an organization, SUPER_OWNER must immediately add the first OWNER
9. The system must validate that organization email is unique across all organizations
10. The system must initialize the member count to 1 when creating an organization with first owner

### User Invitation & Management
11. OWNERs and ADMINs can directly create new users within their organization via API
12. New users must be assigned a role upon creation (ADMIN can only create AGENT users)
13. The system must update the organization's member count when users are added or removed
14. Users cannot be transferred between organizations

### Data Isolation
15. All data models (Storage, Job, AnalysisResult) must include organizationId field
16. API endpoints must filter data based on the user's organization
17. The system must use subdomain from request headers to identify organization context
18. API endpoints must follow the pattern: `/organizations/:id/[resource]`

### Organization Context Resolution
19. The system must extract organization context from subdomain in request headers
20. JWT tokens must include organizationId and role claims
21. All API requests must validate organization context before processing

### Access Control
22. The system must validate organizationId in every data query
23. AGENTs must only see their own uploaded files, jobs, and analysis results
24. ADMINs and OWNERs must see all data within their organization
25. SUPER_OWNER must be able to access any organization's data

### Limits & Constraints
26. Organizations must have configurable limits for:
    - Maximum number of users
    - Maximum number of concurrent jobs
27. The system must enforce these limits when creating users or jobs
28. Exceeding limits must return appropriate error messages (HTTP 422)

### Data Retention
29. When an organization is deleted, data must be archived (not permanently deleted)
30. Archived data must be retained for a configurable period (default: 90 days)
31. The last OWNER of an organization cannot be removed or leave

## Non-Goals (Out of Scope)

1. **Billing Integration**: Payment processing and subscription management
2. **Organization Merging**: Combining multiple organizations into one
3. **User Multi-Organization Membership**: Users belonging to multiple organizations simultaneously
4. **Custom Roles**: Creating organization-specific roles beyond the four defined
5. **Organization Templates**: Pre-configured organization settings or templates
6. **Bulk User Import**: CSV or bulk user creation features
7. **Organization Analytics**: Cross-organization reporting for Super Owner
8. **White-Label Support**: Custom branding per organization
9. **API Keys**: Organization-specific API key management
10. **Audit Logs**: Detailed activity logging per organization

## API Design Considerations

### Endpoint Structure
- All organization-scoped endpoints should follow: `/api/organizations/:organizationId/[resource]`
- Organization ID should be validated from both URL and JWT token
- Mismatch between URL organizationId and token organizationId should return 403 Forbidden

### Authentication Flow
- Login endpoint must return JWT with organizationId and role claims
- Token payload structure:
  ```json
  {
    "sub": "userId",
    "username": "user@example.com",
    "email": "user@example.com",
    "organizationId": "org-uuid",
    "role": "OWNER",
    "iat": 1234567890,
    "exp": 1234567890
  }
  ```

### Request Headers
- Expect organization subdomain in custom header: `X-Organization-Subdomain`
- Use subdomain to validate against organizationId in JWT
- Return 400 Bad Request if subdomain header is missing

## Technical Considerations

### Database Schema
- Add Organization table with proper indexes on email and subdomain
- Add organizationId foreign key to User, Storage, Job, and AnalysisResult tables
- Add role enum field to User table
- Create composite indexes for efficient organization-based queries
- Implement database-level constraints for data integrity

### Authentication & Authorization
- Extend JWT payload to include organizationId and role
- Implement OrganizationGuard for automatic request filtering
- Update CurrentUser decorator to include organization context
- Ensure all queries include organizationId in WHERE clause

### Service Layer Updates
- All services must accept organizationId as a parameter
- Repository pattern must include organization filtering
- Implement organization-scoped validators
- Add organization context to all error messages

### Performance
- Index all tables on organizationId for efficient filtering
- Consider partitioning large tables by organizationId in the future
- Cache organization metadata for subdomain resolution
- Implement database connection pooling per organization if needed

### Security
- Implement row-level security at the application level
- Validate organizationId in all service methods
- Prevent SQL injection in organization-based queries
- Regular security audits for multi-tenant vulnerabilities
- Implement rate limiting per organization

## Success Metrics

1. **Zero Cross-Organization Data Leaks**: No security incidents where data from one organization is accessible to another
2. **Sub-100ms Organization Context Resolution**: Subdomain to organization mapping completes within 100ms
3. **95% User Role Accuracy**: API correctly enforces role permissions 95% of the time
4. **API Response Time**: No more than 5% increase in API response times after multi-tenancy implementation
5. **Successful Organization Creation**: 99% of organization creation API calls complete successfully
6. **Data Isolation Validation**: 100% of API endpoints properly filter by organizationId

## Open Questions

1. **Subdomain Validation**: How will subdomain uniqueness be enforced at the API level?
2. **Organization Naming**: Should organization names be unique, or only subdomains?
3. **Data Migration Tools**: Will we need API endpoints to move data between organizations in the future?
4. **Compliance**: Are there any specific compliance requirements (GDPR, HIPAA) per organization?
5. **Backup Strategy**: Should backups be organization-specific or system-wide?
6. **Rate Limiting**: Should API rate limits be per-organization or per-user?
7. **Default Limits**: What should be the default user and job limits for new organizations?
8. **Super Owner Authentication**: Should Super Owner use a separate authentication mechanism?