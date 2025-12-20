import { authOptions } from '@/libs/auth';
import { db } from '@/libs/db';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/libs/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe('NextAuth Configuration - auth.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CredentialsProvider - authorize', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password: '$2a$10$hashedpassword',
      name: 'John',
      surnames: 'Doe',
      phone: '+1234567890',
      country: 'US',
      imageUrl: 'http://example.com/avatar.jpg',
      emailNotifications: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const getAuthorize = () => {
      const provider = authOptions.providers[0] as any;
      return provider.options.authorize;
    };

    it('should return null when email is missing', async () => {
      const authorize = getAuthorize();
      
      const result = await authorize({ password: 'test123' }, {} as any);
      expect(result).toBeNull();
    });

    it('should return null when password is missing', async () => {
      const authorize = getAuthorize();
      
      const result = await authorize({ email: 'test@example.com' }, {} as any);
      expect(result).toBeNull();
    });

    it('should return null when both credentials are missing', async () => {
      const authorize = getAuthorize();
      
      const result = await authorize({}, {} as any);
      expect(result).toBeNull();
    });

    it('should return null when email is empty string', async () => {
      const authorize = getAuthorize();
      
      const result = await authorize({ email: '', password: 'test123' }, {} as any);
      expect(result).toBeNull();
    });

    it('should return null when password is empty string', async () => {
      const authorize = getAuthorize();
      
      const result = await authorize({ email: 'test@example.com', password: '' }, {} as any);
      expect(result).toBeNull();
    });

    it('should return null when user not found', async () => {
      const authorize = getAuthorize();
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await authorize({
        email: 'notfound@example.com',
        password: 'test123',
      }, {} as any);

      expect(result).toBeNull();
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'notfound@example.com' },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          surnames: true,
          phone: true,
          country: true,
          imageUrl: true,
        },
      });
    });

    it('should return null when password is invalid', async () => {
      const authorize = getAuthorize();
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await authorize({
        email: 'test@example.com',
        password: 'wrongpassword',
      }, {} as any);

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongpassword',
        mockUser.password
      );
    });

    it('should return user when credentials are valid', async () => {
      const authorize = getAuthorize();
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authorize({
        email: 'test@example.com',
        password: 'correctpassword',
      }, {} as any);

      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'John',
        surnames: 'Doe',
        phone: '+1234567890',
        country: 'US',
        image: 'http://example.com/avatar.jpg',
      });

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.any(Object),
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correctpassword',
        mockUser.password
      );
    });

    it('should return user with null optional fields', async () => {
      const authorize = getAuthorize();
      const userWithNulls = {
        ...mockUser,
        phone: null,
        country: null,
        imageUrl: null,
      };
      vi.mocked(db.user.findUnique).mockResolvedValue(userWithNulls as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authorize({
        email: 'test@example.com',
        password: 'correctpassword',
      }, {} as any);

      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'John',
        surnames: 'Doe',
        phone: null,
        country: null,
        image: null,
      });
    });
  });

  describe('JWT Callback', () => {
    it('should populate token with user data on first sign in', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'John',
        surnames: 'Doe',
        phone: '+1234567890',
        country: 'US',
      };

      const token = {};
      const result = await authOptions.callbacks!.jwt!({
        token,
        user: mockUser,
        trigger: 'signIn',
      } as any);

      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'John',
        surnames: 'Doe',
        phone: '+1234567890',
        country: 'US',
      });
    });

    it('should preserve existing token when no user provided', async () => {
      const existingToken = {
        id: '1',
        email: 'test@example.com',
        name: 'John',
        surnames: 'Doe',
        phone: '+1234567890',
        country: 'US',
      };

      const result = await authOptions.callbacks!.jwt!({
        token: existingToken,
        trigger: 'update',
      } as any);

      expect(result).toEqual(existingToken);
    });

    it('should handle user with minimal data', async () => {
      const mockUser = {
        id: '2',
        email: 'minimal@example.com',
        name: 'Jane',
      };

      const token = { existingField: 'value' };
      const result = await authOptions.callbacks!.jwt!({
        token,
        user: mockUser,
        trigger: 'signIn',
      } as any);

      expect(result.id).toBe('2');
      expect(result.email).toBe('minimal@example.com');
      expect(result.name).toBe('Jane');
    });

    it('should add all user fields to token', async () => {
      const mockUser = {
        id: '3',
        email: 'full@example.com',
        name: 'Full',
        surnames: 'User',
        phone: '+9876543210',
        country: 'ES',
      };

      const token = {};
      const result = await authOptions.callbacks!.jwt!({
        token,
        user: mockUser,
        trigger: 'signIn',
      } as any);

      expect(result.id).toBe('3');
      expect(result.email).toBe('full@example.com');
      expect(result.name).toBe('Full');
      expect(result.surnames).toBe('User');
      expect(result.phone).toBe('+9876543210');
      expect(result.country).toBe('ES');
    });
  });

  describe('Session Callback', () => {
    it('should populate session with token data', async () => {
      const mockToken = {
        id: '1',
        email: 'test@example.com',
        name: 'John',
        surnames: 'Doe',
        phone: '+1234567890',
        country: 'US',
      };

      const mockSession = {
        user: {},
        expires: '2024-12-31',
      };

      const result = await authOptions.callbacks!.session!({
        session: mockSession,
        token: mockToken,
      } as any);

      expect(result.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'John',
        surnames: 'Doe',
        phone: '+1234567890',
        country: 'US',
      });
    });

    it('should handle session without user object', async () => {
      const mockToken = {
        id: '1',
        email: 'test@example.com',
      };

      const mockSession = {
        expires: '2024-12-31',
      };

      const result = await authOptions.callbacks!.session!({
        session: mockSession as any,
        token: mockToken,
      } as any);

      expect(result).toEqual(mockSession);
    });

    it('should convert string id to number in session', async () => {
      const mockToken = {
        id: '123',
        email: 'test@example.com',
        name: 'Test',
      };

      const mockSession = {
        user: {},
        expires: '2024-12-31',
      };

      const result = await authOptions.callbacks!.session!({
        session: mockSession,
        token: mockToken,
      } as any);

      expect((result.user as any).id).toBe(123);
      expect(typeof (result.user as any).id).toBe('number');
    });

    it('should preserve session expires field', async () => {
      const mockToken = {
        id: '1',
        email: 'test@example.com',
      };

      const mockSession = {
        user: {},
        expires: '2025-06-15T10:30:00Z',
      };

      const result = await authOptions.callbacks!.session!({
        session: mockSession,
        token: mockToken,
      } as any);

      expect(result.expires).toBe('2025-06-15T10:30:00Z');
    });
  });

  describe('Configuration', () => {
    it('should have correct session configuration', () => {
      expect(authOptions.session).toEqual({
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60, // 24 hours
      });
    });

    it('should have correct session strategy', () => {
      expect(authOptions.session?.strategy).toBe('jwt');
    });

    it('should have 30 day session maxAge', () => {
      expect(authOptions.session?.maxAge).toBe(2592000); // 30 * 24 * 60 * 60
    });

    it('should have 24 hour updateAge', () => {
      expect(authOptions.session?.updateAge).toBe(86400); // 24 * 60 * 60
    });

    it('should have JWT secret configured', () => {
      expect(authOptions.jwt?.secret).toBeDefined();
      expect(authOptions.secret).toBeDefined();
    });

    it('should have JWT maxAge configured', () => {
      expect(authOptions.jwt?.maxAge).toBe(2592000); // 30 days
    });

    it('should have one provider configured', () => {
      expect(authOptions.providers).toHaveLength(1);
    });

    it('should have CredentialsProvider configured', () => {
      const provider = authOptions.providers[0] as any;
      expect(provider.name).toBe('Credentials');
    });

    it('should have email and password credentials configured', () => {
      const provider = authOptions.providers[0] as any;
      expect(provider.options.credentials).toHaveProperty('email');
      expect(provider.options.credentials).toHaveProperty('password');
    });

    it('should have email credential with correct type', () => {
      const provider = authOptions.providers[0] as any;
      expect(provider.options.credentials.email.type).toBe('email');
    });

    it('should have password credential with correct type', () => {
      const provider = authOptions.providers[0] as any;
      expect(provider.options.credentials.password.type).toBe('password');
    });
  });

  describe('Edge Cases', () => {
    const getAuthorize = () => {
      const provider = authOptions.providers[0] as any;
      return provider.options.authorize;
    };

    it('should handle undefined credentials object', async () => {
      const authorize = getAuthorize();
      
      const result = await authorize(undefined, {} as any);
      expect(result).toBeNull();
    });

    it('should handle null credentials', async () => {
      const authorize = getAuthorize();
      
      const result = await authorize(null, {} as any);
      expect(result).toBeNull();
    });
  });
});
