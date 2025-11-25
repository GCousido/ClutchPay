import { userCreateSchema, userUpdateSchema } from '@/libs/validations/user';
import { describe, expect, it } from 'vitest';

describe('User Validations', () => {
  describe('userCreateSchema', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Test123!@#',
      name: 'John',
      surnames: 'Doe Smith',
      phone: '+34612345678',
      country: 'ES',
    };

    describe('Valid data', () => {
      it('should accept valid user data', () => {
        const result = userCreateSchema.safeParse(validUser);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe(validUser.email.toLowerCase());
        }
      });

      it('should accept user without optional fields', () => {
        const minimalUser = {
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'John',
          surnames: 'Doe',
        };

        const result = userCreateSchema.safeParse(minimalUser);
        expect(result.success).toBe(true);
      });

      it('should normalize email to lowercase', () => {
        const user = { ...validUser, email: 'TEST@EXAMPLE.COM' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@example.com');
        }
      });

      it('should normalize country to uppercase', () => {
        const user = { ...validUser, country: 'es' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.country).toBe('ES');
        }
      });
    });

    describe('Email validation', () => {
      it('should reject invalid email', () => {
        const user = { ...validUser, email: 'invalid-email' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('email');
        }
      });

      it('should reject empty email', () => {
        const user = { ...validUser, email: '' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });
    });

    describe('Password validation', () => {
      it('should reject password without uppercase', () => {
        const user = { ...validUser, password: 'test123!@#' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
        if (!result.success) {
          const passwordError = result.error.issues.find((i) =>
            i.path.includes('password')
          );
          expect(passwordError?.message).toContain('uppercase');
        }
      });

      it('should reject password without lowercase', () => {
        const user = { ...validUser, password: 'TEST123!@#' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should reject password without number', () => {
        const user = { ...validUser, password: 'TestTest!@#' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should reject password without special character', () => {
        const user = { ...validUser, password: 'Test123456' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should reject password shorter than 8 characters', () => {
        const user = { ...validUser, password: 'Tt1!' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should reject password longer than 255 characters', () => {
        const user = { ...validUser, password: 'T1!' + 'a'.repeat(253) };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });
    });

    describe('Phone validation', () => {
      it('should accept valid international phone', () => {
        const user = { ...validUser, phone: '+34612345678' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
      });

      it('should reject invalid phone format', () => {
        const user = { ...validUser, phone: '123' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should accept null phone', () => {
        const user = { ...validUser, phone: null };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
      });

      it('should format phone to E.164', () => {
        const user = { ...validUser, phone: '+34 612 34 56 78' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.phone).toBe('+34612345678');
        }
      });
    });

    describe('Country validation', () => {
      it('should accept valid ISO country code', () => {
        const user = { ...validUser, country: 'US' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
      });

      it('should reject invalid country code length', () => {
        const user = { ...validUser, country: 'USA' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should accept null country', () => {
        const user = { ...validUser, country: null };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
      });
    });

    describe('Name validation', () => {
      it('should reject name shorter than 2 characters', () => {
        const user = { ...validUser, name: 'J' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should reject name longer than 100 characters', () => {
        const user = { ...validUser, name: 'a'.repeat(101) };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(false);
      });

      it('should trim whitespace from name', () => {
        const user = { ...validUser, name: '  John  ' };
        const result = userCreateSchema.safeParse(user);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('John');
        }
      });
    });
  });

  describe('userUpdateSchema', () => {
    it('should allow partial updates', () => {
      const update = { name: 'NewName' };
      const result = userUpdateSchema.safeParse(update);

      expect(result.success).toBe(true);
    });

    it('should validate updated fields', () => {
      const update = { email: 'invalid-email' };
      const result = userUpdateSchema.safeParse(update);

      expect(result.success).toBe(false);
    });

    it('should accept empty object', () => {
      const update = {};
      const result = userUpdateSchema.safeParse(update);

      expect(result.success).toBe(true);
    });
  });
});
