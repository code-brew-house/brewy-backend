# Brewy Organization Management - Postman Collection

This directory contains Postman collections and environments for testing the Brewy organization management API endpoints.

## Files

- **`Brewy-Organization-Management.postman_collection.json`** - Complete API collection
- **`Brewy-Organization-Environment.postman_environment.json`** - Environment variables
- **`README.md`** - This documentation file

## Quick Start

### 1. Import into Postman

1. Open Postman
2. Click **Import** button
3. Drag and drop both JSON files or use **Upload Files**
4. Import both the collection and environment

### 2. Set Up Environment

1. Select the **Brewy Organization Environment** from the environment dropdown
2. Update the `base_url` variable if your API is not running on `http://localhost:3000`
3. All other variables will be set automatically during test execution

### 3. Run the Collection

#### Option A: Run Individual Requests
1. Expand the collection folders
2. Run requests in the suggested order (see **Test Flow** below)
3. Environment variables will be automatically populated

#### Option B: Run Complete Collection
1. Right-click on **Brewy Organization Management** collection
2. Select **Run collection**
3. Configure run settings:
   - **Iterations**: 1
   - **Delay**: 1000ms (recommended for API rate limiting)
   - **Data file**: None required
4. Click **Run Brewy Organization Management**

## Test Flow

The collection is organized to follow a logical testing flow:

### 1. Authentication
- **Register Super Owner** - Creates a super owner user
- **Login Super Owner** - Authenticates and sets JWT token

### 2. Organization CRUD
- **Create Organization** - Creates a test organization
- **Get All Organizations** - Lists all organizations
- **Get Organization by ID** - Retrieves specific organization
- **Update Organization** - Modifies organization details

### 3. User Management
- **Add Owner to Organization** - Adds an owner user
- **Add Admin to Organization** - Adds an admin user  
- **Add Agent to Organization** - Adds an agent user

### 4. Organization Limits
- **Create Organization with Custom Limits** - Tests limit configuration
- **Test User Limit** - Demonstrates limit enforcement

### 5. Admin Functions
- **Get All Organizations (Admin View)** - Super owner admin view
- **Search Organizations by Name** - Filtered search
- **Search Organizations by Email** - Email-based filtering

### 6. Subdomain Context
- **Get Organizations with Subdomain Header** - Tests subdomain routing
- **Create Organization with Subdomain Context** - Subdomain-aware creation

### 7. Error Scenarios
- **Create Organization - Invalid Data** - Validation error testing
- **Get Organization - Not Found** - 404 error handling
- **Create Organization - Duplicate Email** - Conflict error testing
- **Access Admin Endpoint - Unauthorized** - Authorization testing

### 8. Data Cleanup
- **Delete Test Organization** - Removes test data
- **Logout** - Cleans up authentication

## Environment Variables

The collection uses these environment variables (automatically managed):

| Variable | Description | Set By |
|----------|-------------|---------|
| `base_url` | API base URL | Manual configuration |
| `jwt_token` | Current JWT token | Authentication requests |
| `super_owner_token` | Super owner JWT token | Super owner login |
| `organization_id` | Test organization ID | Create organization |
| `user_id` | Test user ID | Create user requests |
| `limited_org_id` | Limited organization ID | Limit testing |

## Test Scenarios Covered

### ✅ **Basic CRUD Operations**
- Create organizations with validation
- Retrieve organizations (list and by ID)
- Update organization details
- Soft delete organizations

### ✅ **User Management**
- Add users with different roles (OWNER, ADMIN, AGENT)
- Role-based user creation
- Organization membership management

### ✅ **Authentication & Authorization**
- JWT token authentication
- Role-based access control
- Super owner privileges
- Unauthorized access prevention

### ✅ **Organization Limits**
- User limit enforcement
- Concurrent job limits
- Custom limit configuration

### ✅ **Multi-tenant Features**
- Organization data isolation
- Subdomain-based routing
- Cross-organization admin access

### ✅ **Error Handling**
- Validation errors (400)
- Not found errors (404)
- Conflict errors (409)
- Unauthorized access (401/403)

### ✅ **Search & Filtering**
- Name-based organization search
- Email-based filtering
- Pagination support

## Expected Results

When running the complete collection, you should see:

- **All tests passing** (green status)
- **Environment variables populated** automatically
- **Proper error handling** for invalid scenarios
- **Data cleanup** at the end

## Configuration for Different Environments

### Development Environment
```json
{
  "base_url": "http://localhost:3000"
}
```

### Staging Environment
```json
{
  "base_url": "https://api-staging.brewy.com"
}
```

### Production Environment
```json
{
  "base_url": "https://api.brewy.com"
}
```

## Common Issues & Troubleshooting

### 1. **401 Unauthorized Errors**
- Ensure you've run the authentication requests first
- Check that JWT token is set in environment variables
- Verify the user has appropriate permissions

### 2. **404 Not Found Errors**
- Ensure the API server is running
- Check the base_url environment variable
- Verify the endpoint paths are correct

### 3. **409 Conflict Errors**
- Run the cleanup requests to remove test data
- Use unique email addresses for organizations
- Clear environment variables between test runs

### 4. **Rate Limiting (429 Errors)**
- Add delays between requests in collection runner
- Reduce concurrent request volume
- Wait before retrying requests

### 5. **Validation Errors (400)**
- Review request body format
- Ensure all required fields are provided
- Check field validation rules in API documentation

## Advanced Usage

### Custom Test Scripts

Each request includes test scripts that:
- Validate response status codes
- Check response data structure
- Set environment variables for subsequent requests
- Provide meaningful error messages

### Data-Driven Testing

To test with multiple datasets:
1. Create a CSV file with test data
2. Use Postman's **Data File** feature in collection runner
3. Reference data with `{{column_name}}` syntax

### CI/CD Integration

Use Newman (Postman CLI) for automated testing:

```bash
# Install Newman
npm install -g newman

# Run collection
newman run Brewy-Organization-Management.postman_collection.json \
  -e Brewy-Organization-Environment.postman_environment.json \
  --reporters cli,junit \
  --reporter-junit-export results.xml
```

## Support

For issues with the Postman collection:
1. Check the API documentation in README.md
2. Review the test scripts in failing requests
3. Verify environment variable values
4. Check API server logs for detailed error information