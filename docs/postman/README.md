# Brewy Backend API - Postman Collection

This directory contains comprehensive Postman collections and environments for testing all Brewy backend API endpoints including organization management, storage operations, audio analysis, user management, and health checks.

## Files

- **`Brewy-Organization-Management.postman_collection.json`** - Complete API collection (v2.1.0 with paginated analysis results)
- **`Brewy-Organization-Environment.postman_environment.json`** - Environment variables
- **`Get-All-Analysis-Results.postman_request.json`** - Standalone request collection for the new paginated endpoint
- **`README.md`** - This documentation file

## Additional Documentation

- **`../api-endpoints/audio-analysis-results-pagination.md`** - Comprehensive API documentation for the new paginated endpoint

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

### 7. Storage Operations
- **Upload File** - Upload MP3 files to storage (50MB limit)
- **List Files** - Get all stored files for organization
- **Get File by ID** - Retrieve specific file metadata
- **Update File Metadata** - Modify file information
- **Get Presigned URL** - Generate secure file access URL
- **Get Storage Stats** - View storage usage statistics
- **Delete File** - Remove file from storage

### 8. Audio Analysis
- **Upload Audio for Analysis** - Upload and process audio files (20MB limit)
- **Get Job Status** - Check analysis job progress
- **Get Analysis Results** - Retrieve completed analysis results
- **Get All Analysis Results (Paginated)** - Fetch all analysis results with pagination and filtering

### 9. Audio Analysis Webhook
- **Process Webhook** - Handle analysis service callbacks

### 10. User Profile
- **Get User Profile** - Get current user information
- **Get User by ID** - Retrieve specific user details

### 11. System Health
- **Health Check** - System status endpoint (no auth required)

### 12. Application
- **Hello World** - Basic connectivity test (no auth required)

### 13. Error Scenarios
- **Create Organization - Invalid Data** - Validation error testing
- **Get Organization - Not Found** - 404 error handling
- **Create Organization - Duplicate Email** - Conflict error testing
- **Access Admin Endpoint - Unauthorized** - Authorization testing

### 14. Data Cleanup
- **Delete Test Organization** - Removes test data
- **Logout** - Cleans up all authentication tokens

## Environment Variables

The collection uses these environment variables (automatically managed):

| Variable | Description | Set By |
|----------|-------------|---------|
| `base_url` | API base URL | Manual configuration |
| `jwt_token` | Current JWT token | Authentication requests |
| `super_owner_token` | Super owner JWT token | Super owner login |
| `owner_token` | Organization owner token | Owner login |
| `admin_token` | Organization admin token | Admin login |
| `agent_token` | Organization agent token | Agent login |
| `organization_id` | Test organization ID | Create organization |
| `user_id` | Test user ID | Create user requests |
| `limited_org_id` | Limited organization ID | Limit testing |
| `storage_file_id` | Storage file ID | File upload |
| `audio_job_id` | Audio analysis job ID | Audio upload |
| `audio_file_id` | Audio file storage ID | Audio upload |
| `presigned_url` | File access URL | Presigned URL generation |

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
- User profile retrieval

### ✅ **Authentication & Authorization**
- JWT token authentication with automatic validation
- Role-based access control
- Super owner privileges
- Unauthorized access prevention
- Global token management and expiration checking

### ✅ **File Storage Operations**
- MP3 file uploads (50MB limit)
- File metadata management
- Presigned URL generation
- Storage statistics
- File deletion

### ✅ **Audio Analysis**
- Audio file processing (20MB limit)
- Asynchronous job tracking
- Analysis results retrieval
- Paginated analysis results with filtering and sorting
- Webhook handling for external services

### ✅ **Organization Limits**
- User limit enforcement
- Concurrent job limits
- Custom limit configuration

### ✅ **Multi-tenant Features**
- Organization data isolation
- Subdomain-based routing
- Cross-organization admin access

### ✅ **System Monitoring**
- Health check endpoints
- Application status monitoring
- Error logging and debugging

### ✅ **Error Handling**
- Validation errors (400)
- Not found errors (404)
- Conflict errors (409)
- Unauthorized access (401/403)
- Global error response handling

### ✅ **Search & Filtering**
- Name-based organization search
- Email-based filtering
- Pagination support
- Audio analysis results pagination with sorting

## New Features in v2.1.0

### 🎵 **Paginated Audio Analysis Results**

The collection now includes a new endpoint for retrieving all audio analysis results with advanced pagination and filtering capabilities:

**Endpoint:** `GET /audio-analysis/results`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (max: 100, default: 20)
- `sortBy` (optional): Field to sort by (default: createdAt)
- `sortOrder` (optional): Sort direction - `asc` or `desc` (default: desc)

**Response Structure:**
```json
{
  "data": [
    {
      "id": "uuid",
      "jobId": "uuid",
      "transcript": "Transcribed text content...",
      "sentiment": "positive|negative|neutral",
      "metadata": { "confidence": 0.95 },
      "createdAt": "2024-01-01T00:00:00Z",
      "job": {
        "id": "uuid",
        "status": "completed",
        "file": {
          "filename": "audio.mp3",
          "size": 1024
        }
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Features:**
- **Organization Isolation**: Users see only their organization's results
- **SUPER_OWNER Access**: Super owners can access results from all organizations
- **Latest First**: Results sorted by creation date (newest first) by default
- **Efficient Pagination**: Optimized database queries with metadata
- **Comprehensive Testing**: Validates response structure and pagination metadata

## New Features & Improvements

### 🔐 **Enhanced JWT Token Management**
- **Global Bearer Authentication**: Collection-level JWT token management
- **Automatic Token Validation**: Pre-request scripts check token expiration
- **Smart Error Handling**: Automatic detection of authentication issues
- **Multi-Role Support**: Support for different user role tokens
- **Comprehensive Cleanup**: Logout clears all authentication tokens

### 📁 **File Upload Support**
- **Multipart Form Data**: Proper file upload configuration
- **File Type Validation**: MP3 file validation in requests
- **Size Limit Awareness**: Different limits for storage (50MB) vs analysis (20MB)
- **Presigned URL Testing**: Secure file access URL generation

### 🎵 **Audio Analysis Workflow**
- **Job Tracking**: Environment variables for analysis job management
- **Status Monitoring**: Real-time job status checking
- **Results Retrieval**: Completed analysis data access
- **Webhook Simulation**: Testing external service callbacks

### 🏥 **System Health Monitoring**
- **No-Auth Endpoints**: Health checks without authentication
- **Status Validation**: Proper system status response checking
- **Debugging Support**: Enhanced logging and error reporting

## Expected Results

When running the complete collection, you should see:

- **All tests passing** (green status)
- **Environment variables populated** automatically
- **Proper error handling** for invalid scenarios
- **Enhanced logging** with emojis for better debugging
- **Token validation warnings** when authentication issues occur
- **Data cleanup** at the end with complete variable clearing

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