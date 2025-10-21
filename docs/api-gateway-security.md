# API Gateway Security Documentation

## Overview

The API Gateway has been enhanced with comprehensive security features and middleware to protect against common web vulnerabilities and provide robust request handling.

## Security Features

### 1. Rate Limiting

**Implementation:** `express-rate-limit`

**Configuration:**
- **Default:** 100 requests per 15 minutes per IP
- **Strict:** 20 requests per 15 minutes (for auth endpoints)
- **Lenient:** 300 requests per 15 minutes (for read-only endpoints)
- **Upload:** 10 requests per 15 minutes (for file uploads)

**Features:**
- IP-based tracking with X-Forwarded-For support
- Standard rate limit headers (RateLimit-*)
- Automatic retry-after calculations
- Custom error responses with timestamps

**Usage:**
```typescript
import { defaultRateLimiter, strictRateLimiter } from './api-gateway/middleware/rateLimitMiddleware';

// Apply to all routes
app.use(defaultRateLimiter);

// Apply to specific routes
app.post('/auth/login', strictRateLimiter, loginHandler);
```

### 2. Security Headers

**Implementation:** `helmet`

**Headers Set:**
- Content-Security-Policy (CSP)
- X-DNS-Prefetch-Control
- X-Frame-Options (DENY)
- X-Content-Type-Options (nosniff)
- Strict-Transport-Security (HSTS)
- Referrer-Policy
- Removes X-Powered-By

**Environment-Specific:**
- **Production:** Full security headers enabled
- **Development:** CSP and HSTS disabled for easier development

**Usage:**
```typescript
import { getSecurityMiddleware } from './api-gateway/middleware/securityMiddleware';

app.use(getSecurityMiddleware());
```

### 3. CORS Configuration

**Implementation:** `cors`

**Features:**
- Origin validation with whitelist
- Credentials support (cookies, authorization headers)
- Custom headers support
- Preflight request handling
- Automatic origin detection from environment

**Configuration:**
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**Default Development Origins:**
- http://localhost:3000
- http://localhost:5173
- http://localhost:8080
- http://127.0.0.1:3000
- http://127.0.0.1:5173
- http://127.0.0.1:8080

**Usage:**
```typescript
import { getCorsMiddleware } from './api-gateway/middleware/corsMiddleware';

app.use(getCorsMiddleware());
```

### 4. Request Logging

**Implementation:** `morgan`

**Formats:**
- **Production:** Combined format (Apache-style)
- **Development:** Dev format (colored, concise)
- **Custom:** JSON format for log aggregation

**Logged Information:**
- Request method and URL
- Status code
- Response time
- Content length
- Request ID
- User ID (if authenticated)
- User agent
- Remote address

**Usage:**
```typescript
import { getLoggingMiddleware } from './api-gateway/middleware/loggingMiddleware';

app.use(getLoggingMiddleware());
```

### 5. Error Handling

**Features:**
- Global error handler middleware
- Proper HTTP status codes (400, 401, 403, 404, 422, 429, 500, 503)
- Consistent error response format
- Error logging with request context
- Stack traces in development mode
- Sensitive data redaction

**Error Types Handled:**
- API errors (custom ApiError class)
- Validation errors (422)
- JWT errors (401)
- File upload errors (400)
- Database errors (422)
- CORS errors (403)
- Not found errors (404)

**Usage:**
```typescript
import { errorHandlerMiddleware, asyncHandler } from './api-gateway/middleware/errorMiddleware';

// Apply global error handler (must be last)
app.use(errorHandlerMiddleware);

// Wrap async routes
app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await getUsers();
  res.json(users);
}));
```

## Middleware Stack Order

The middleware is applied in a specific order for optimal security and performance:

1. **Health Check** - Bypasses other middleware for quick health checks
2. **Request ID** - Generates unique ID for request tracking
3. **Response Time** - Tracks request processing time
4. **Security Headers** - Helmet security headers
5. **CORS** - Cross-origin resource sharing
6. **Logging** - Request logging with Morgan
7. **Body Parsing** - JSON and URL-encoded body parsing
8. **Rate Limiting** - Request rate limiting
9. **Custom Middleware** - Application-specific middleware
10. **Routes** - Application routes
11. **CORS Error Handler** - CORS policy violations
12. **404 Handler** - Not found errors
13. **Error Handler** - Global error handling (must be last)

## Security Orchestrator

The Security Orchestrator provides convenient functions to apply all security middleware:

### Production Setup
```typescript
import express from 'express';
import { applyProductionSecurityMiddleware } from './api-gateway';

const app = express();

// Apply all production security middleware
applyProductionSecurityMiddleware(app);

// Add your routes here
app.get('/api/users', usersHandler);

app.listen(3000);
```

### Development Setup
```typescript
import { applyMinimalSecurityMiddleware } from './api-gateway';

const app = express();

// Apply minimal security for development
applyMinimalSecurityMiddleware(app);

// Add your routes
app.get('/api/users', usersHandler);
```

### Custom Setup
```typescript
import { applySecurityMiddleware } from './api-gateway';

const app = express();

applySecurityMiddleware(app, {
  enableSecurity: true,
  enableCors: true,
  enableLogging: true,
  enableRateLimit: true,
  rateLimitPreset: 'strict', // or 'default', 'lenient'
  customMiddleware: [myCustomMiddleware]
});
```

## Environment Variables

Required environment variables for security configuration:

```env
# Environment (affects security settings)
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Logging Format
LOG_FORMAT=combined  # or 'dev', 'json'

# Rate Limiting (optional overrides)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Best Practices

### 1. Rate Limiting
- Use strict rate limiting for authentication endpoints
- Use lenient rate limiting for public read-only endpoints
- Monitor rate limit violations for potential attacks

### 2. CORS
- Always specify allowed origins in production
- Never use wildcard (*) in production
- Keep CORS configuration as restrictive as possible

### 3. Error Handling
- Never expose sensitive information in error messages
- Log all errors with request context
- Use proper HTTP status codes
- Implement error monitoring and alerting

### 4. Logging
- Use structured logging (JSON) for production
- Include request IDs for tracing
- Sanitize sensitive data from logs
- Implement log rotation and retention policies

### 5. Security Headers
- Enable all security headers in production
- Keep CSP directives as restrictive as possible
- Enable HSTS with includeSubDomains
- Regularly audit security headers

## Testing Security

### Rate Limiting Test
```bash
# Test rate limiting
for i in {1..150}; do
  curl -X GET http://localhost:3000/api/users
done
# Should return 429 after 100 requests
```

### CORS Test
```bash
# Test CORS
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://localhost:3000/api/users
# Should block unauthorized origins
```

### Security Headers Test
```bash
# Test security headers
curl -I http://localhost:3000/api/users
# Should see X-Content-Type-Options, X-Frame-Options, etc.
```

## Security Vulnerabilities Addressed

- **OWASP A01:2021** - Broken Access Control (Rate limiting, CORS)
- **OWASP A02:2021** - Cryptographic Failures (HSTS, secure headers)
- **OWASP A03:2021** - Injection (CSP, input validation)
- **OWASP A05:2021** - Security Misconfiguration (Helmet headers)
- **OWASP A07:2021** - Authentication Failures (Rate limiting on auth)
- **OWASP A09:2021** - Security Logging Failures (Comprehensive logging)

## Monitoring and Alerting

### Key Metrics to Monitor
- Rate limit violations per IP
- CORS policy violations
- Error rates by status code
- Response times by endpoint
- Authentication failures
- Invalid request patterns

### Recommended Alerts
- Rate limit violations exceeding threshold
- Unusual error rate spikes
- Multiple authentication failures from same IP
- CORS policy violations from unknown origins

## Support

For questions or issues with the API Gateway security implementation:
- Review this documentation
- Check the middleware source code in `/src/api-gateway/middleware/`
- Consult the SPARC architecture documentation
- Contact the backend development team

---

**Last Updated:** 2025-10-21
**Version:** 1.0.0
**Maintained By:** Backend Development Team
