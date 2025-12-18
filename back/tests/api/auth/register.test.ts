import { POST } from '@/app/api/auth/register/route';
import { db } from '@/libs/db';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRequest, getJsonResponse } from '../../helpers/request';

describe('POST /api/auth/register', () => {
  const validPayload = {
    email: 'test@example.com',
    password: 'Test123!@#',
    name: 'Test',
    surnames: 'User',
    phone: '+34612345678',
    country: 'ES',
  };

  beforeEach(async () => {
    await db.user.deleteMany({});
  });

  describe('Successful registration', () => {
    it('should create user with valid data', async () => {
      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: validPayload,
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const json = await getJsonResponse(res);
      expect(json.email).toBe(validPayload.email);
      expect(json.name).toBe(validPayload.name);
      expect(json.surnames).toBe(validPayload.surnames);
      expect(json.password).toBeUndefined(); // Password should not be returned
    });

    it('should hash the password in database', async () => {
      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: validPayload,
      });

      await POST(req);

      const user = await db.user.findUnique({
        where: { email: validPayload.email },
      });

      expect(user).not.toBeNull();
      expect(user!.password).not.toBe(validPayload.password);
      expect(bcrypt.compareSync(validPayload.password, user!.password)).toBe(true);
    });

    it('should create user with optional fields as null', async () => {
      const minimalPayload = {
        email: 'minimal@example.com',
        password: 'Test123!@#',
        name: 'Minimal',
        surnames: 'User',
      };

      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: minimalPayload,
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const user = await db.user.findUnique({
        where: { email: minimalPayload.email },
      });

      expect(user!.phone).toBeNull();
      expect(user!.country).toBeNull();
      expect(user!.imageUrl).toBeNull();
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for invalid email', async () => {
      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: { ...validPayload, email: 'invalid-email' },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Validation failed');
      // Verify errors is object map: { field: message }
      expect(typeof json.errors).toBe('object');
      expect(Array.isArray(json.errors)).toBe(false);
      expect(json.errors.email).toBeDefined();
      expect(typeof json.errors.email).toBe('string');
    });

    it('should return 400 for weak password', async () => {
      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: { ...validPayload, password: 'weak' },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      // Verify error format: { password: "error message" }
      expect(typeof json.errors).toBe('object');
      expect(Array.isArray(json.errors)).toBe(false);
      expect(json.errors.password).toBeDefined();
      expect(typeof json.errors.password).toBe('string');
    });

    it('should return 400 for missing required fields', async () => {
      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: { email: 'test@example.com' },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.errors).toBeDefined();
      expect(Object.keys(json.errors).length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid phone number', async () => {
      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: { ...validPayload, phone: '123' },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      // Verify errors object format
      expect(typeof json.errors).toBe('object');
      expect(Array.isArray(json.errors)).toBe(false);
      expect(json.errors.phone).toBeDefined();
      expect(typeof json.errors.phone).toBe('string');
    });

    it('should return 400 for invalid country code', async () => {
      const req = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: { ...validPayload, country: 'INVALID' },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      // Verify errors is object map format
      expect(typeof json.errors).toBe('object');
      expect(Array.isArray(json.errors)).toBe(false);
      expect(json.errors.country).toBeDefined();
      expect(typeof json.errors.country).toBe('string');
    });
  });

  describe('Duplicate email', () => {
    it('should return 400 when email already exists', async () => {
      // Create first user
      const req1 = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: validPayload,
      });
      await POST(req1);

      // Try to create duplicate
      const req2 = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: validPayload,
      });
      const res = await POST(req2);

      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Cannot create user - email already in use');
    });

    it('should allow registration with different email', async () => {
      // Create first user
      const req1 = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: validPayload,
      });
      await POST(req1);

      // Create second user with different email
      const req2 = createRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: { ...validPayload, email: 'different@example.com' },
      });
      const res = await POST(req2);

      expect(res.status).toBe(201);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });
});
