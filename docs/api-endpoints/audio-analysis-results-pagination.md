# Audio Analysis Results Pagination API

## Overview

This document describes the new paginated API endpoint for retrieving all audio analysis results by organizationId. This endpoint provides efficient access to analysis results with advanced pagination, sorting, and filtering capabilities.

## Endpoint Details

### Get All Analysis Results (Paginated)

**HTTP Method:** `GET`
**Endpoint:** `/audio-analysis/results`
**Authentication:** Required (JWT Bearer Token)
**Authorization:** All roles (SUPER_OWNER, OWNER, ADMIN, AGENT)

## Request Parameters

### Query Parameters

| Parameter | Type | Required | Default | Max Value | Description |
|-----------|------|----------|---------|-----------|-------------|
| `page` | number | No | 1 | N/A | Page number (starts from 1) |
| `limit` | number | No | 20 | 100 | Number of results per page |
| `sortBy` | string | No | createdAt | N/A | Field to sort by (currently supports: createdAt) |
| `sortOrder` | string | No | desc | N/A | Sort direction (asc or desc) |

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer JWT token |
| `Content-Type` | No | application/json |

## Response Format

### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "jobId": "550e8400-e29b-41d4-a716-446655440001",
      "transcript": "This is the transcribed content from the audio analysis.",
      "sentiment": "positive",
      "metadata": {
        "confidence": 0.95,
        "words": 145,
        "duration": 120.5
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "job": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "status": "completed",
        "file": {
          "filename": "meeting-recording.mp3",
          "size": 2048576
        }
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Response Schema

#### Data Object
| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier for the analysis result |
| `jobId` | string (UUID) | Associated job identifier |
| `transcript` | string | Transcribed text from audio analysis |
| `sentiment` | string | Sentiment analysis result (positive, negative, neutral) |
| `metadata` | object | Additional analysis metadata (confidence scores, etc.) |
| `createdAt` | string (ISO 8601) | Timestamp when analysis was completed |
| `job` | object | Associated job information |
| `job.id` | string (UUID) | Job identifier |
| `job.status` | string | Job status (completed, failed, etc.) |
| `job.file` | object | Original file information |
| `job.file.filename` | string | Original filename |
| `job.file.size` | number | File size in bytes |

#### Meta Object (Pagination)
| Field | Type | Description |
|-------|------|-------------|
| `page` | number | Current page number |
| `limit` | number | Results per page |
| `total` | number | Total number of results available |
| `totalPages` | number | Total number of pages |
| `hasNextPage` | boolean | Whether there are more pages available |
| `hasPreviousPage` | boolean | Whether there are previous pages |

## Error Responses

### 400 Bad Request
Invalid query parameters or malformed request.

```json
{
  "statusCode": 400,
  "message": [
    "Page must be at least 1",
    "Limit cannot exceed 100"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized
Missing or invalid authentication token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
User lacks sufficient permissions.

```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### 500 Internal Server Error
Server-side error occurred.

```json
{
  "statusCode": 500,
  "message": "Failed to retrieve analysis results",
  "error": "Internal Server Error"
}
```

## Authorization Behavior

### Organization Isolation
- **Regular Users** (OWNER, ADMIN, AGENT): Can only access results from their own organization
- **SUPER_OWNER**: Can access results from all organizations

### Role-Based Access
- **SUPER_OWNER**: Full access to all organization results
- **OWNER**: Access to own organization results
- **ADMIN**: Access to own organization results  
- **AGENT**: Access to own organization results

## Example Requests

### Basic Request (Default Pagination)
```bash
curl -X GET "http://localhost:3000/audio-analysis/results" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json"
```

### Custom Pagination
```bash
curl -X GET "http://localhost:3000/audio-analysis/results?page=2&limit=10&sortOrder=asc" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json"
```

### Large Page Size
```bash
curl -X GET "http://localhost:3000/audio-analysis/results?limit=100" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json"
```

## Pagination Best Practices

### Efficient Navigation
1. **Start with defaults**: Use default pagination for initial requests
2. **Check metadata**: Use `hasNextPage` and `hasPreviousPage` for navigation
3. **Reasonable page sizes**: Use appropriate `limit` values (10-50 for UI, up to 100 for bulk operations)
4. **Consistent sorting**: Maintain consistent `sortBy` and `sortOrder` across pages

### Performance Considerations
1. **Large datasets**: Use smaller page sizes (10-20) for better response times
2. **Caching**: Consider caching results for frequently accessed pages
3. **Filtering**: Use specific date ranges or other filters when possible
4. **Monitoring**: Monitor response times and adjust page sizes accordingly

## Integration Examples

### JavaScript/Fetch
```javascript
async function getAnalysisResults(page = 1, limit = 20) {
  const response = await fetch(`/audio-analysis/results?page=${page}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}
```

### Python/Requests
```python
import requests

def get_analysis_results(base_url, jwt_token, page=1, limit=20, sort_order='desc'):
    headers = {
        'Authorization': f'Bearer {jwt_token}',
        'Content-Type': 'application/json'
    }
    
    params = {
        'page': page,
        'limit': limit,
        'sortBy': 'createdAt',
        'sortOrder': sort_order
    }
    
    response = requests.get(f'{base_url}/audio-analysis/results', 
                          headers=headers, params=params)
    
    response.raise_for_status()
    return response.json()
```

### TypeScript Interface
```typescript
interface AnalysisResult {
  id: string;
  jobId: string;
  transcript: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  metadata: Record<string, any>;
  createdAt: string;
  job: {
    id: string;
    status: string;
    file: {
      filename: string;
      size: number;
    };
  };
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

type AnalysisResultsResponse = PaginatedResponse<AnalysisResult>;
```

## Testing the Endpoint

### Unit Tests
The endpoint includes comprehensive unit tests covering:
- Pagination logic validation
- Sort order verification
- Authorization checks
- Error handling scenarios
- Data transformation accuracy

### Integration Tests
Integration tests verify:
- End-to-end request/response flow
- Database query optimization
- Organization isolation
- Role-based access control

### Load Testing
Consider testing with:
- Large datasets (1000+ results)
- High concurrency (multiple simultaneous requests)
- Various page sizes and sort orders
- Different user roles and organizations

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial release of paginated audio analysis results endpoint
- Support for basic pagination (page, limit)
- Sorting by creation date (asc/desc)
- Organization-based access control
- Comprehensive test coverage
- Postman collection integration

## Support

For questions or issues related to this endpoint:
1. Check the API logs for detailed error information
2. Verify authentication tokens are valid and not expired
3. Ensure user has appropriate permissions for the organization
4. Review query parameters for valid ranges and formats

## Related Endpoints

- `POST /audio-analysis/upload` - Upload audio for analysis
- `GET /audio-analysis/jobs/:jobId` - Get specific job status
- `GET /audio-analysis/jobs/:jobId/results` - Get results for specific job
- `POST /audio-analysis/webhook` - Webhook for external analysis services