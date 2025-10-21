import {
  createRequestContext,
  logRequest,
  normalizeQueryParams,
  validateParams,
  sanitizeData
} from '../../api-gateway/middleware/requestMiddleware';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-12345')
}));

// Mock console.log
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

describe('requestMiddleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequestContext', () => {
    it('should create context with default values', () => {
      const context = createRequestContext();

      expect(context.requestId).toBe('test-uuid-12345');
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.isAuthenticated).toBe(false);
      expect(context.params).toEqual({});
      expect(context.query).toBeUndefined();
      expect(context.body).toBeUndefined();
    });

    it('should create context with provided params', () => {
      const params = { id: '123', name: 'test' };

      const context = createRequestContext(params);

      expect(context.params).toEqual(params);
    });

    it('should create context with query and body', () => {
      const params = { id: '123' };
      const query = { filter: 'active' };
      const body = { data: 'test' };

      const context = createRequestContext(params, query, body);

      expect(context.params).toEqual(params);
      expect(context.query).toEqual(query);
      expect(context.body).toEqual(body);
    });

    it('should generate unique request IDs', () => {
      const context1 = createRequestContext();
      const context2 = createRequestContext();

      expect(context1.requestId).toBeDefined();
      expect(context2.requestId).toBeDefined();
    });

    it('should set current timestamp', () => {
      const before = new Date();
      const context = createRequestContext();
      const after = new Date();

      expect(context.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(context.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('logRequest', () => {
    const context = createRequestContext({ id: '123' });

    it('should log request details', () => {
      logRequest(context, '/api/players', 'GET');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API Gateway] GET /api/players',
        expect.objectContaining({
          requestId: context.requestId,
          userId: 'anonymous',
          timestamp: context.timestamp,
          params: { id: '123' }
        })
      );
    });

    it('should log authenticated user ID', () => {
      const authenticatedContext = {
        ...context,
        userId: 'user-456'
      };

      logRequest(authenticatedContext, '/api/matches', 'POST');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API Gateway] POST /api/matches',
        expect.objectContaining({
          userId: 'user-456'
        })
      );
    });

    it('should log different HTTP methods', () => {
      logRequest(context, '/api/players', 'PUT');
      logRequest(context, '/api/players', 'DELETE');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API Gateway] PUT /api/players',
        expect.any(Object)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API Gateway] DELETE /api/players',
        expect.any(Object)
      );
    });
  });

  describe('normalizeQueryParams', () => {
    it('should convert string "true" to boolean', () => {
      const query = { active: 'true' };

      const normalized = normalizeQueryParams(query);

      expect(normalized.active).toBe(true);
    });

    it('should convert string "false" to boolean', () => {
      const query = { active: 'false' };

      const normalized = normalizeQueryParams(query);

      expect(normalized.active).toBe(false);
    });

    it('should convert numeric strings to numbers', () => {
      const query = { limit: '10', offset: '20' };

      const normalized = normalizeQueryParams(query);

      expect(normalized.limit).toBe(10);
      expect(normalized.offset).toBe(20);
    });

    it('should not convert empty strings to numbers', () => {
      const query = { value: '' };

      const normalized = normalizeQueryParams(query);

      expect(normalized.value).toBe('');
    });

    it('should convert comma-separated values to arrays', () => {
      const query = { tags: 'tag1,tag2,tag3' };

      const normalized = normalizeQueryParams(query);

      expect(normalized.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should trim array values', () => {
      const query = { tags: 'tag1, tag2 , tag3' };

      const normalized = normalizeQueryParams(query);

      expect(normalized.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should pass through other values unchanged', () => {
      const query = { name: 'test', description: 'some text' };

      const normalized = normalizeQueryParams(query);

      expect(normalized.name).toBe('test');
      expect(normalized.description).toBe('some text');
    });

    it('should handle undefined query params', () => {
      const normalized = normalizeQueryParams();

      expect(normalized).toEqual({});
    });

    it('should handle empty query params', () => {
      const normalized = normalizeQueryParams({});

      expect(normalized).toEqual({});
    });
  });

  describe('validateParams', () => {
    it('should validate required string field', () => {
      const params = { name: 'test' };
      const schema = { name: { type: 'string' as const, required: true } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail when required field is missing', () => {
      const params = {};
      const schema = { name: { type: 'string' as const, required: true } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'name' is required");
    });

    it('should validate number type', () => {
      const params = { age: 25 };
      const schema = { age: { type: 'number' as const } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(true);
    });

    it('should fail when type is incorrect', () => {
      const params = { age: 'twenty-five' };
      const schema = { age: { type: 'number' as const } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'age' must be a number");
    });

    it('should validate string min length', () => {
      const params = { password: 'short' };
      const schema = { password: { type: 'string' as const, min: 8 } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'password' must be at least 8 characters");
    });

    it('should validate string max length', () => {
      const params = { username: 'a'.repeat(21) };
      const schema = { username: { type: 'string' as const, max: 20 } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'username' must be at most 20 characters");
    });

    it('should validate number min value', () => {
      const params = { age: 5 };
      const schema = { age: { type: 'number' as const, min: 18 } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'age' must be at least 18");
    });

    it('should validate number max value', () => {
      const params = { score: 150 };
      const schema = { score: { type: 'number' as const, max: 100 } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'score' must be at most 100");
    });

    it('should validate boolean type', () => {
      const params = { active: true };
      const schema = { active: { type: 'boolean' as const } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(true);
    });

    it('should validate array type', () => {
      const params = { tags: ['tag1', 'tag2'] };
      const schema = { tags: { type: 'array' as const } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(true);
    });

    it('should validate array min length', () => {
      const params = { items: [1] };
      const schema = { items: { type: 'array' as const, min: 2 } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'items' must have at least 2 items");
    });

    it('should validate enum values', () => {
      const params = { status: 'active' };
      const schema = { status: { type: 'string' as const, enum: ['active', 'inactive'] } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(true);
    });

    it('should fail when enum value is invalid', () => {
      const params = { status: 'pending' };
      const schema = { status: { type: 'string' as const, enum: ['active', 'inactive'] } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'status' must be one of: active, inactive");
    });

    it('should skip validation for optional undefined fields', () => {
      const params = {};
      const schema = { name: { type: 'string' as const, required: false } };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(true);
    });

    it('should collect multiple errors', () => {
      const params = { age: 'invalid', name: '' };
      const schema = {
        age: { type: 'number' as const, required: true },
        name: { type: 'string' as const, required: true }
      };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('sanitizeData', () => {
    it('should redact password fields', () => {
      const data = { username: 'test', password: 'secret123' };

      const sanitized = sanitizeData(data);

      expect(sanitized.username).toBe('test');
      expect(sanitized.password).toBe('[REDACTED]');
    });

    it('should redact token fields', () => {
      const data = { userId: '123', token: 'abc123' };

      const sanitized = sanitizeData(data);

      expect(sanitized.userId).toBe('123');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    it('should redact secret and apiKey fields', () => {
      const data = {
        name: 'app',
        secret: 'secret123',
        apiKey: 'key123'
      };

      const sanitized = sanitizeData(data);

      expect(sanitized.name).toBe('app');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });

    it('should sanitize nested objects', () => {
      const data = {
        user: {
          name: 'test',
          password: 'secret'
        }
      };

      const sanitized = sanitizeData(data);

      expect(sanitized.user.name).toBe('test');
      expect(sanitized.user.password).toBe('[REDACTED]');
    });

    it('should sanitize arrays', () => {
      const data = [
        { username: 'user1', password: 'pass1' },
        { username: 'user2', password: 'pass2' }
      ];

      const sanitized = sanitizeData(data);

      expect(sanitized[0].username).toBe('user1');
      expect(sanitized[0].password).toBe('[REDACTED]');
      expect(sanitized[1].username).toBe('user2');
      expect(sanitized[1].password).toBe('[REDACTED]');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeData(null)).toBeNull();
      expect(sanitizeData(undefined)).toBeUndefined();
    });

    it('should pass through primitive values', () => {
      expect(sanitizeData('test')).toBe('test');
      expect(sanitizeData(123)).toBe(123);
      expect(sanitizeData(true)).toBe(true);
    });

    it('should not mutate original data', () => {
      const data = { username: 'test', password: 'secret' };
      const original = { ...data };

      sanitizeData(data);

      expect(data).toEqual(original);
    });
  });
});
