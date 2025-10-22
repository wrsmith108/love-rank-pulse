/**
 * Request Validation Middleware
 *
 * Provides Express middleware for validating requests using Zod schemas.
 * Integrates with the validation library for type-safe request validation.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, formatValidationErrors } from '../../lib/validation';
import { ApiErrors } from './errorMiddleware';

/**
 * Validation target (where to validate)
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Create validation middleware for a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param target - Where to apply validation (body, query, params)
 * @returns Express middleware function
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get data to validate based on target
    const dataToValidate = req[target];

    // Perform validation
    const result = validate(schema, dataToValidate);

    if (!result.success) {
      // Format validation errors
      const errorDetails = result.errors?.reduce((acc, error) => {
        acc[error.field] = error.message;
        return acc;
      }, {} as Record<string, string>);

      // Throw validation error
      next(ApiErrors.ValidationError(errorDetails || {}));
      return;
    }

    // Attach validated data to request
    (req as any).validated = result.data;

    next();
  };
}

/**
 * Validate multiple targets at once
 *
 * @param schemas - Object mapping targets to schemas
 * @returns Express middleware function
 */
export function validateMultiple(schemas: {
  body?: z.ZodSchema<any>;
  query?: z.ZodSchema<any>;
  params?: z.ZodSchema<any>;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string> = {};
    const validated: any = {};

    // Validate each target
    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const dataToValidate = req[target as ValidationTarget];
      const result = validate(schema, dataToValidate);

      if (!result.success) {
        result.errors?.forEach(error => {
          errors[`${target}.${error.field}`] = error.message;
        });
      } else {
        validated[target] = result.data;
      }
    }

    // If there are errors, throw validation error
    if (Object.keys(errors).length > 0) {
      next(ApiErrors.ValidationError(errors));
      return;
    }

    // Attach all validated data to request
    (req as any).validated = validated;

    next();
  };
}

/**
 * Sanitize and normalize request data
 *
 * @returns Express middleware function
 */
export function sanitizeRequest() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Trim string values in body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Trim string values in query
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query as any);
    }

    next();
  };
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj.trim();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate UUID parameter
 *
 * @param paramName - Name of the parameter to validate
 * @returns Express middleware function
 */
export function validateUUID(paramName: string = 'id') {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return (req: Request, res: Response, next: NextFunction): void => {
    const paramValue = req.params[paramName];

    if (!paramValue || !uuidRegex.test(paramValue)) {
      next(ApiErrors.BadRequest(`Invalid UUID for parameter '${paramName}'`));
      return;
    }

    next();
  };
}

/**
 * Validate pagination parameters
 *
 * @returns Express middleware function
 */
export function validatePagination() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { limit, offset } = req.query;

    // Validate and normalize limit
    if (limit !== undefined) {
      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        next(ApiErrors.BadRequest('Limit must be between 1 and 100'));
        return;
      }
      req.query.limit = limitNum as any;
    } else {
      req.query.limit = 20 as any; // Default limit
    }

    // Validate and normalize offset
    if (offset !== undefined) {
      const offsetNum = parseInt(offset as string, 10);
      if (isNaN(offsetNum) || offsetNum < 0) {
        next(ApiErrors.BadRequest('Offset must be a non-negative number'));
        return;
      }
      req.query.offset = offsetNum as any;
    } else {
      req.query.offset = 0 as any; // Default offset
    }

    next();
  };
}

/**
 * Validate required fields in request
 *
 * @param fields - Array of required field names
 * @param target - Where to check for fields
 * @returns Express middleware function
 */
export function requireFields(
  fields: string[],
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[target];
    const missing: string[] = [];

    for (const field of fields) {
      if (!(field in data) || data[field] === undefined || data[field] === null || data[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      const errorDetails = missing.reduce((acc, field) => {
        acc[field] = `Field '${field}' is required`;
        return acc;
      }, {} as Record<string, string>);

      next(ApiErrors.ValidationError(errorDetails));
      return;
    }

    next();
  };
}
