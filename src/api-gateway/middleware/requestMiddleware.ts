import { RequestContext } from '../ApiGateway';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request Middleware
 * 
 * Handles common request processing tasks such as:
 * - Request ID generation
 * - Timestamp recording
 * - Parameter normalization
 * - Request logging
 */

/**
 * Create a new request context
 * @param params Request parameters
 * @param query Optional query parameters
 * @param body Optional request body
 * @returns Initialized request context
 */
export function createRequestContext(
  params: Record<string, any> = {},
  query?: Record<string, any>,
  body?: any
): RequestContext {
  return {
    requestId: uuidv4(),
    timestamp: new Date(),
    isAuthenticated: false,
    params,
    query,
    body
  };
}

/**
 * Log request details
 * @param context Request context
 * @param path Request path
 * @param method HTTP method
 */
export function logRequest(
  context: RequestContext,
  path: string,
  method: string
): void {
  console.log(`[API Gateway] ${method} ${path}`, {
    requestId: context.requestId,
    userId: context.userId || 'anonymous',
    timestamp: context.timestamp,
    params: context.params
  });
}

/**
 * Normalize query parameters
 * @param query Raw query parameters
 * @returns Normalized query parameters
 */
export function normalizeQueryParams(
  query: Record<string, any> = {}
): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  // Process each query parameter
  Object.entries(query).forEach(([key, value]) => {
    // Convert string 'true'/'false' to boolean
    if (value === 'true') {
      normalized[key] = true;
    } else if (value === 'false') {
      normalized[key] = false;
    }
    // Convert numeric strings to numbers
    else if (!isNaN(Number(value)) && value !== '') {
      normalized[key] = Number(value);
    }
    // Handle arrays (comma-separated values)
    else if (typeof value === 'string' && value.includes(',')) {
      normalized[key] = value.split(',').map(item => item.trim());
    }
    // Pass through other values
    else {
      normalized[key] = value;
    }
  });
  
  return normalized;
}

/**
 * Validate request parameters against a schema
 * @param params Parameters to validate
 * @param schema Validation schema
 * @returns Validation result
 */
export function validateParams(
  params: Record<string, any>,
  schema: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    required?: boolean;
    enum?: any[];
    min?: number;
    max?: number;
  }>
): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  // Check each field in the schema
  Object.entries(schema).forEach(([field, rules]) => {
    const value = params[field];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field '${field}' is required`);
      return;
    }
    
    // Skip validation for undefined optional fields
    if (value === undefined || value === null) {
      return;
    }
    
    // Type validation
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field '${field}' must be a string`);
        } else if (rules.min !== undefined && value.length < rules.min) {
          errors.push(`Field '${field}' must be at least ${rules.min} characters`);
        } else if (rules.max !== undefined && value.length > rules.max) {
          errors.push(`Field '${field}' must be at most ${rules.max} characters`);
        }
        break;
        
      case 'number':
        if (typeof value !== 'number') {
          errors.push(`Field '${field}' must be a number`);
        } else if (rules.min !== undefined && value < rules.min) {
          errors.push(`Field '${field}' must be at least ${rules.min}`);
        } else if (rules.max !== undefined && value > rules.max) {
          errors.push(`Field '${field}' must be at most ${rules.max}`);
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Field '${field}' must be a boolean`);
        }
        break;
        
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Field '${field}' must be an array`);
        } else if (rules.min !== undefined && value.length < rules.min) {
          errors.push(`Field '${field}' must have at least ${rules.min} items`);
        } else if (rules.max !== undefined && value.length > rules.max) {
          errors.push(`Field '${field}' must have at most ${rules.max} items`);
        }
        break;
    }
    
    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Sanitize sensitive data from request/response
 * @param data Data to sanitize
 * @returns Sanitized data
 */
export function sanitizeData(data: any): any {
  if (!data) {
    return data;
  }
  
  // For arrays, sanitize each item
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  // For objects, sanitize each property
  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      // Remove sensitive fields
      if (['password', 'token', 'secret', 'apiKey'].includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    });
    
    return sanitized;
  }
  
  // Return primitive values as-is
  return data;
}