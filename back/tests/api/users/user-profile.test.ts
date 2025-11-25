// tests/api/users/user-profile.test.ts
import { GET, PUT } from '@/app/api/users/[id]/route';
import { db } from '@/libs/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearMockSession, createAuthenticatedRequest, getJsonResponse } from '../../helpers/request';

describe('GET /api/users/[id]', () => {
  let testUser: any;

  beforeAll(async () => {
    await db.user.deleteMany({});

    testUser = await db.user.create({
      data: {
        email: 'profile-test@test.com',
        password: 'HashedPassword123!',
        name: 'Profile',
        surnames: 'Test',
        phone: '+34612345678',
        country: 'ES',
        imageUrl: 'https://example.com/avatar.jpg',
      },
    });
  });

  afterAll(async () => {
    await db.user.deleteMany({
      where: {
        email: {
          contains: 'userprofile.test.com',
        },
      },
    });
  });

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      clearMockSession();
      const req = new Request(`http://localhost/api/users/${testUser.id}`, {
        method: 'GET',
      });

      const res = await GET(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(401);
    });

    it('should return 403 when accessing another user profile', async () => {
      const otherUser = await db.user.create({
        data: {
          email: 'other@userprofile.test.com',
          password: 'HashedPassword123!',
          name: 'Other',
          surnames: 'User',
        },
      });

      const req = createAuthenticatedRequest(`http://localhost/api/users/${otherUser.id}`, {
        method: 'GET',
        userId: testUser.id,
      });

      // Test development behavior: cross-user access allowed
      const resInDev = await GET(req, { params: Promise.resolve({ id: String(otherUser.id) }) });
      expect(resInDev.status).toBe(200);

      // Test production behavior: cross-user access forbidden
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { 
        value: 'production', 
        writable: true, 
        configurable: true, 
        enumerable: true 
      });
      const resInProd = await GET(req, { params: Promise.resolve({ id: String(otherUser.id) }) });
      expect(resInProd.status).toBe(403);
      Object.defineProperty(process.env, 'NODE_ENV', { 
        value: originalEnv, 
        writable: true, 
        configurable: true, 
        enumerable: true 
      });

      await db.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('Successful retrieval', () => {
    it('should return user profile', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.id).toBe(testUser.id);
      expect(json.email).toBe(testUser.email);
      expect(json.name).toBe(testUser.name);
      expect(json.surnames).toBe(testUser.surnames);
      expect(json.phone).toBe(testUser.phone);
      expect(json.country).toBe(testUser.country);
      expect(json.imageUrl).toBe(testUser.imageUrl);
      expect(json.password).toBeUndefined(); // Should not return password
    });

    it('should include createdAt timestamp', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      const json = await getJsonResponse(res);

      expect(json.createdAt).toBeDefined();
      expect(new Date(json.createdAt)).toBeInstanceOf(Date);
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid user ID (non-numeric)', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/invalid', {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req, { params: Promise.resolve({ id: 'invalid' }) });
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Invalid user id');
    });

    it('should return 400 for invalid user ID (NaN)', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/abc123', {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req, { params: Promise.resolve({ id: 'abc123' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('Edge cases', () => {
    it('should return null for non-existent user', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/99999', {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req, { params: Promise.resolve({ id: '99999' }) });
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json).toBeNull();
    });
  });
});

describe('PUT /api/users/[id]', () => {
  let testUser: any;

  beforeAll(async () => {
    await db.user.deleteMany({
      where: {
        email: {
          contains: 'userprofile.test.com',
        },
      },
    });

    testUser = await db.user.create({
      data: {
        email: 'update-test@userprofile.test.com',
        password: 'HashedPassword123!',
        name: 'Update',
        surnames: 'Test',
        phone: '+34612345678',
        country: 'ES',
      },
    });
  });

  afterAll(async () => {
    await db.user.deleteMany({
      where: {
        email: {
          contains: 'userprofile.test.com',
        },
      },
    });
  });

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      clearMockSession();
      const req = new Request(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' }),
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(401);
    });
  });

  describe('Successful updates', () => {
    it('should update user name', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { name: 'Updated Name' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.name).toBe('Updated Name');

      const updated = await db.user.findUnique({ where: { id: testUser.id } });
      expect(updated?.name).toBe('Updated Name');
    });

    it('should update multiple fields', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: {
          name: 'New Name',
          surnames: 'New Surnames',
          phone: '+34987654321',
          country: 'FR',
        },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.name).toBe('New Name');
      expect(json.surnames).toBe('New Surnames');
      expect(json.phone).toBe('+34987654321');
      expect(json.country).toBe('FR');
    });

    it('should update imageUrl', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { imageUrl: 'https://example.com/new-avatar.jpg' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.imageUrl).toBe('https://example.com/new-avatar.jpg');
    });

    it('should allow partial updates', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { phone: '+34612345678' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.phone).toBe('+34612345678');
      // Other fields should remain unchanged
      expect(json.name).toBe('New Name'); // From previous test
    });

    it('should accept empty object (no changes)', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: {},
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(200);
    });

    it('should set optional fields to null', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: {
          phone: null,
          country: null,
          imageUrl: null,
        },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.phone).toBeNull();
      expect(json.country).toBeNull();
      expect(json.imageUrl).toBeNull();
    });
  });

  describe('Validation errors', () => {
    it('should reject invalid email format', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { email: 'invalid-email' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { password: 'weak' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(400);
    });

    it('should reject invalid phone format', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { phone: '123' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(400);
    });

    it('should reject invalid country code', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { country: 'INVALID' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(400);
    });

    it('should reject invalid imageUrl', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { imageUrl: 'not-a-url' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(400);
    });

    it('should reject name too short', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { name: 'A' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(400);
    });

    it('should reject name too long', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        userId: testUser.id,
        body: { name: 'A'.repeat(101) },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(400);
    });
  });

  describe('Edge cases', () => {
    it('should return 400 for invalid user ID', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/invalid', {
        method: 'PUT',
        userId: testUser.id,
        body: { name: 'Test' },
      });

      const res = await PUT(req, { params: Promise.resolve({ id: 'invalid' }) });
      expect(res.status).toBe(400);
    });

    it('should handle malformed JSON', async () => {
      const req = new Request(`http://localhost/api/users/${testUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      (req as any).__mockSession = { user: { id: testUser.id, email: testUser.email } };

      const res = await PUT(req, { params: Promise.resolve({ id: String(testUser.id) }) });
      expect(res.status).toBe(500);
    });
  });
});
