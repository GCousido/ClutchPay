import { formatZodError, validateAsync } from '@/libs/validations';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('Validation Helpers', () => {
  describe('formatZodError', () => {
    it('should convert Zod errors to object map format', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const result = schema.safeParse({ email: 'invalid', age: 10 });

      if (!result.success) {
        const errors = formatZodError(result.error);

        // Should return object map, not array
        expect(typeof errors).toBe('object');
        expect(Array.isArray(errors)).toBe(false);
        expect(errors.email).toBeDefined();
        expect(typeof errors.email).toBe('string');
        expect(errors.age).toBeDefined();
        expect(typeof errors.age).toBe('string');
      }
    });

    it('should use "body" as default field for empty path', () => {
      const schema = z.email();
      const result = schema.safeParse('invalid');

      if (!result.success) {
        const errors = formatZodError(result.error);
        // Root validation errors use 'body' as field
        expect(errors.body).toBeDefined();
        expect(typeof errors.body).toBe('string');
      }
    });

    it('should join nested paths with dot notation', () => {
      const schema = z.object({
        user: z.object({
          email: z.email(),
        }),
      });

      const result = schema.safeParse({ user: { email: 'invalid' } });

      if (!result.success) {
        const errors = formatZodError(result.error);
        // Nested field should use dot notation
        expect(errors['user.email']).toBeDefined();
        expect(typeof errors['user.email']).toBe('string');
      }
    });
  });

  describe('validateAsync', () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });

    it('should return success for valid data', async () => {
      const data = {
        email: 'test@example.com',
        password: 'ValidPass123',
      };

      const result = await validateAsync(schema, data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it('should return errors for invalid data', async () => {
      const data = {
        email: 'invalid',
        password: 'short',
      };

      const result = await validateAsync(schema, data);

      expect(result.success).toBe(false);
      if (!result.success) {
        // validateAsync returns object map: { field: message }
        expect(typeof result.errors).toBe('object');
        expect(Array.isArray(result.errors)).toBe(false);
        expect(result.errors.email).toBeDefined();
        expect(result.errors.password).toBeDefined();
      }
    });

    it('should handle async transformations', async () => {
      const asyncSchema = z.object({
        value: z.string().transform(async (val) => val.toUpperCase()),
      });

      const result = await validateAsync(asyncSchema, { value: 'test' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).value).toBe('TEST');
      }
    });
  });
});
