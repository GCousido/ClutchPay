// tests/api/users/users-list.test.ts
import { GET } from '@/app/api/users/route';
import { db } from '@/libs/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearMockSession, createAuthenticatedRequest, createRequest, getJsonResponse } from '../../helpers/request';

describe('GET /api/users', () => {
  const testUsers: any[] = [];
  let authUserId: number;

  beforeAll(async () => {
    // Clean up
    await db.user.deleteMany({});

    // Create authenticated user
    const authUser = await db.user.create({
      data: {
        email: 'auth-user@test.com',
        password: 'HashedPassword123!',
        name: 'Auth',
        surnames: 'User',
      },
    });
    authUserId = authUser.id;

    // Create 15 test users for pagination
    for (let i = 1; i <= 15; i++) {
      const user = await db.user.create({
        data: {
          email: `user${i}@test.com`,
          password: 'HashedPassword123!',
          name: `User${i}`,
          surnames: `Test${i}`,
          phone: i % 2 === 0 ? `+3461234567${i}` : null,
          country: i % 3 === 0 ? 'ES' : null,
          imageUrl: i % 4 === 0 ? `https://example.com/avatar${i}.jpg` : null,
        },
      });
      testUsers.push(user);
    }
  });

afterAll(async () => {
  await db.user.deleteMany({
    where: {
      email: {
        contains: 'userslist.test.com',
      },
    },
  });
});
  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      clearMockSession();
      const req = new Request('http://localhost/api/users', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('Pagination', () => {
    it('should return first page with default limit (10)', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.total).toBe(16); // 15 test users + 1 auth user
      expect(json.meta.totalPages).toBe(2);
      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(10);
      expect(json.meta.nextPage).toBe(2);
      expect(json.meta.prevPage).toBeNull();
      expect(json.data).toHaveLength(10);
    });

    it('should return second page', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users?page=2', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.page).toBe(2);
      expect(json.meta.nextPage).toBeNull();
      expect(json.meta.prevPage).toBe(1);
      expect(json.data).toHaveLength(6);
    });

    it('should handle custom limit', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users?limit=5', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.limit).toBe(5);
      expect(json.meta.totalPages).toBe(4); // 16 users / 5 per page = 4 pages
      expect(json.data).toHaveLength(5);
    });

    it('should handle page beyond total pages', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users?page=999', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.page).toBe(999);
      expect(json.data).toHaveLength(0);
    });

    it('should handle invalid page number (defaults to 1)', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users?page=invalid', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.page).toBe(1);
    });
  });

  describe('Response structure', () => {
    it('should not return passwords', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      const json = await getJsonResponse(res);

      json.data.forEach((user: any) => {
        expect(user.password).toBeUndefined();
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.name).toBeDefined();
        expect(user.surnames).toBeDefined();
      });
    });

    it('should order users by createdAt desc', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users?limit=20', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      const json = await getJsonResponse(res);

      const dates = json.data.map((u: any) => new Date(u.createdAt).getTime());
      const sortedDates = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sortedDates);
    });

    it('should include optional fields (phone, country, imageUrl)', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users?limit=20', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      const json = await getJsonResponse(res);

      const userWithPhone = json.data.find((u: any) => u.phone);
      const userWithCountry = json.data.find((u: any) => u.country);
      const userWithImage = json.data.find((u: any) => u.imageUrl);

      expect(userWithPhone).toBeDefined();
      expect(userWithCountry).toBeDefined();
      expect(userWithImage).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty database', async () => {
      clearMockSession();
      await db.user.deleteMany({});

      const req = createRequest('http://localhost/api/users', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401); // requireAuth will fail first
    });

    it('should handle very large limit', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users?limit=1000', {
        method: 'GET',
        userId: authUserId,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.limit).toBe(1000);
    });
  });
});
