import { authOptions } from '@/libs/auth';
import { db } from '@/libs/db';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';

describe('NextAuth Credentials Provider', () => {
  // Extract authorize function from credentials provider
  const credentialsProvider = (authOptions.providers as any[]).find(
    (p) => p.id === 'credentials' || p.name === 'Credentials'
  );
  const authorizeFn = credentialsProvider?.options?.authorize;

  if (!authorizeFn) {
    throw new Error('Credentials provider not found in authOptions');
  }

  const testPassword = 'Test123!@#';
  let testUserId: number;

  beforeEach(async () => {
    // Limpiar y crear usuario de test antes de cada test
    await db.user.deleteMany({});
    
    const user = await db.user.create({
      data: {
        email: 'authtest@example.com',
        password: bcrypt.hashSync(testPassword, 10),
        name: 'Auth',
        surnames: 'Test',
      },
    });
    testUserId = user.id;
  });

  describe('Successful authentication', () => {
    it('should return user when credentials are valid', async () => {
      const result = await authorizeFn({
        email: 'authtest@example.com',
        password: testPassword,
      });

      expect(result).toBeTruthy();
      expect(result.email).toBe('authtest@example.com');
      expect(result.id).toBeDefined(); // ID can be string or number depending on JWT encoding
      expect(result.name).toBe('Auth');
    });

    it('should not return password in result', async () => {
      const result = await authorizeFn({
        email: 'authtest@example.com',
        password: testPassword,
      });

      expect(result.password).toBeUndefined();
    });
  });

  describe('Failed authentication', () => {
    it('should throw error when user not found', async () => {
      await expect(
        authorizeFn({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
      ).rejects.toThrow();
    });

    it('should throw error when password is incorrect', async () => {
      await expect(
        authorizeFn({
          email: 'authtest@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow();
    });

    it('should throw error when email is missing', async () => {
      await expect(
        authorizeFn({
          email: '',
          password: testPassword,
        })
      ).rejects.toThrow();
    });

    it('should throw error when password is missing', async () => {
      await expect(
        authorizeFn({
          email: 'authtest@example.com',
          password: '',
        })
      ).rejects.toThrow();
    });

    it('should throw error when both credentials are missing', async () => {
      await expect(
        authorizeFn({
          email: '',
          password: '',
        })
      ).rejects.toThrow();
    });
  });
});
