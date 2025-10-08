---
applyTo: 'packages/api/**'
---

# API Package Guidelines

## Purpose

The `@rb9k/api` package provides the backend API server for Resume Builder 9000, handling:

- Resume and job description ingestion
- Resume tailoring requests
- Persistence of data in SQLite database
- API endpoints for the web client

## REST API Design

1. **Endpoint Structure**
   - `/api/ingest/resume` - POST - Upload and parse resume
   - `/api/ingest/jd` - POST - Submit job description
   - `/api/tailor` - POST - Generate tailored resume

2. **Status Codes**
   - 200: Successful GET/PUT
   - 201: Successful creation
   - 202: Accepted but processing
   - 400: Invalid request
   - 404: Resource not found
   - 500: Server error

3. **Response Format**

```typescript
// Success response
{
  data: { ... },  // Response payload
  meta: { ... }   // Pagination, etc.
}

// Error response
{
  error: {
    message: "Human readable error",
    code: "ERROR_CODE"
  }
}
```

## File Handling

- Use multer for file uploads
- Store files in a structured format
- Handle various file types as specified (PDF, DOCX, TXT)

## Database Usage

- Use prepared statements for all SQL
- Include proper error handling for DB operations
- Implement transactions for operations that modify multiple records

## Testing

- Use supertest for API endpoint testing
- Mock external services and database when testing
- Test both happy path and error scenarios
