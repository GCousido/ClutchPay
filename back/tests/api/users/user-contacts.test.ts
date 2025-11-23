// tests/api/users/user-contacts.test.ts
import { GET, POST, DELETE } from '@/app/api/users/[id]/contacts/route';
import { db } from '@/libs/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearMockSession, createAuthenticatedRequest, getJsonResponse } from '../../helpers/request';

// Shared data across all tests
let testUser: any;
let contacts: any[] = [];
let targetContact: any;
let existingContact: any;
let otherUser: any;
let lonelyUser: any;

beforeAll(async () => {
  // Clean up only this suite's data
  await db.user.deleteMany({
    where: {
      email: {
        contains: 'usercontacts.test.com',
      },
    },
  });

  // Create 12 contact users for GET tests with unique prefix
  for (let i = 1; i <= 12; i++) {
    const contact = await db.user.create({
      data: {
        email: `contact${i}@usercontacts.test.com`,
        password: 'HashedPassword123!',
        name: `Contact${i}`,
        surnames: `Test${i}`,
        phone: i % 2 === 0 ? `+3461234${i.toString().padStart(4, '0')}` : null,
        country: i % 3 === 0 ? 'ES' : null,
        imageUrl: i % 4 === 0 ? `https://example.com/contact${i}.jpg` : null,
      },
    });
    contacts.push(contact);
  }

  // Create a contact that will be pre-added for duplicate test
  existingContact = await db.user.create({
    data: {
      email: 'existing-contact@usercontacts.test.com',
      password: 'HashedPassword123!',
      name: 'Existing',
      surnames: 'Contact',
    },
  });

  // Create main test user first
  testUser = await db.user.create({
    data: {
      email: 'contacts-test@usercontacts.test.com',
      password: 'HashedPassword123!',
      name: 'Main',
      surnames: 'User',
    },
  });

  // Then connect all contacts
  await db.user.update({
    where: { id: testUser.id },
    data: {
      contacts: {
        connect: [
          ...contacts.map((c) => ({ id: c.id })),
          { id: existingContact.id },
        ],
      },
    },
  });

  // Create target contact for POST tests (not connected to testUser yet)
  targetContact = await db.user.create({
    data: {
      email: 'target@usercontacts.test.com',
      password: 'HashedPassword123!',
      name: 'Target',
      surnames: 'Contact',
      phone: '+34612345678',
      country: 'ES',
      imageUrl: 'https://example.com/target.jpg',
    },
  });

  // Create other users for specific tests
  otherUser = await db.user.create({
    data: {
      email: 'other@usercontacts.test.com',
      password: 'HashedPassword123!',
      name: 'Other',
      surnames: 'User',
    },
  });

  lonelyUser = await db.user.create({
    data: {
      email: 'lonely@usercontacts.test.com',
      password: 'HashedPassword123!',
      name: 'Lonely',
      surnames: 'User',
    },
  });
});

afterAll(async () => {
  await db.user.deleteMany({
    where: {
      email: {
        contains: 'usercontacts.test.com',
      },
    },
  });
});

describe('GET /api/users/[id]/contacts', () => {
  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      clearMockSession();
      const req = new Request(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('should return 403 when accessing another user contacts', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${otherUser.id}/contacts`, {
        method: 'GET',
        userId: testUser.id,
      });

      // Test development behavior: cross-user access allowed
      const resInDev = await GET(req);
      expect(resInDev.status).toBe(200);

      // Test production behavior: cross-user access forbidden
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { 
        value: 'production', 
        writable: true, 
        configurable: true, 
        enumerable: true 
      });
      const resInProd = await GET(req);
      expect(resInProd.status).toBe(403);
      Object.defineProperty(process.env, 'NODE_ENV', { 
        value: originalEnv, 
        writable: true, 
        configurable: true, 
        enumerable: true 
      });
    });
  });

  describe('Successful retrieval', () => {
    it('should return contacts with default pagination', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.total).toBe(13); // 12 contacts + 1 existingContact
      expect(json.meta.totalPages).toBe(2);
      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(10);
      expect(json.data).toHaveLength(10);
    });

    it('should return second page of contacts', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts?page=2`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.page).toBe(2);
      expect(json.meta.prevPage).toBe(1);
      expect(json.meta.nextPage).toBeNull();
      expect(json.data).toHaveLength(3); // 13 total - 10 on page 1 = 3 on page 2
    });

    it('should handle custom limit', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts?limit=5`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.limit).toBe(5);
      expect(json.meta.totalPages).toBe(3); // 13 / 5 = 3 pages
      expect(json.data).toHaveLength(5);
    });

    it('should not return passwords in contact data', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      const json = await getJsonResponse(res);

      json.data.forEach((contact: any) => {
        expect(contact.password).toBeUndefined();
        expect(contact.id).toBeDefined();
        expect(contact.email).toBeDefined();
        expect(contact.name).toBeDefined();
        expect(contact.surnames).toBeDefined();
      });
    });

    it('should include optional fields (phone, country, imageUrl)', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts?limit=20`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      const json = await getJsonResponse(res);

      const contactWithPhone = json.data.find((c: any) => c.phone);
      const contactWithCountry = json.data.find((c: any) => c.country);
      const contactWithImage = json.data.find((c: any) => c.imageUrl);

      expect(contactWithPhone).toBeDefined();
      expect(contactWithCountry).toBeDefined();
      expect(contactWithImage).toBeDefined();
    });

    it('should order contacts by createdAt desc', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts?limit=20`, {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      const json = await getJsonResponse(res);

      // Verificar que están ordenados por creación descendente
      for (let i = 0; i < json.data.length - 1; i++) {
        const current = new Date(json.data[i].createdAt || 0).getTime();
        const next = new Date(json.data[i + 1].createdAt || 0).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid user ID in path', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/invalid/contacts', {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Invalid user id in path');
    });

    it('should return 400 for NaN user ID', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/abc/contacts', {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for user with no contacts', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${lonelyUser.id}/contacts`, {
        method: 'GET',
        userId: lonelyUser.id,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.total).toBe(0);
      expect(json.data).toHaveLength(0);
    });

    it('should handle non-existent user', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/99999/contacts', {
        method: 'GET',
        userId: testUser.id,
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await getJsonResponse(res);
      expect(json.meta.total).toBe(0);
      expect(json.data).toHaveLength(0);
    });
  });
});

describe('POST /api/users/[id]/contacts', () => {
  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      clearMockSession();
      const req = new Request(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactId: targetContact.id }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe('Successful contact addition', () => {
    it('should add contact successfully', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: targetContact.id },
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Contact added');
      expect(json.data.id).toBe(targetContact.id);
      expect(json.data.email).toBe(targetContact.email);
      expect(json.data.name).toBe(targetContact.name);
      expect(json.data.password).toBeUndefined();
    });

    it('should include all contact fields in response', async () => {
      // First remove the contact if it was added by previous test
      await db.user.update({
        where: { id: testUser.id },
        data: {
          contacts: {
            disconnect: { id: targetContact.id },
          },
        },
      });

      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: targetContact.id },
      });

      const res = await POST(req);
      const json = await getJsonResponse(res);

      expect(json.data.phone).toBe(targetContact.phone);
      expect(json.data.country).toBe(targetContact.country);
      expect(json.data.imageUrl).toBe(targetContact.imageUrl);
      expect(json.data.surnames).toBe(targetContact.surnames);
    });

    it('should verify contact is actually added to database', async () => {
      // First remove the contact
      await db.user.update({
        where: { id: testUser.id },
        data: {
          contacts: {
            disconnect: { id: targetContact.id },
          },
        },
      });

      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: targetContact.id },
      });

      await POST(req);

      const user = await db.user.findUnique({
        where: { id: testUser.id },
        include: { contacts: true },
      });

      const hasTarget = user?.contacts.some(c => c.id === targetContact.id);
      expect(hasTarget).toBe(true);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for missing contactId', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: {},
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Validation failed');
      expect(json.errors).toBeDefined();
    });

    it('should return 400 for invalid contactId type', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: 'invalid' },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when trying to add yourself as contact', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: testUser.id },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Cannot add yourself as a contact');
    });

    it('should return 404 for non-existent contact user', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: 99999 },
      });

      const res = await POST(req);
      expect(res.status).toBe(404);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Contact user not found');
    });

    it('should return 400 when contact already exists', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: existingContact.id },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Contact already exists');
    });

    it('should return 400 for invalid user ID in path', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/users/invalid/contacts', {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: targetContact.id },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await getJsonResponse(res);
      expect(json.message).toBe('Invalid user id in path');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JSON', async () => {
      clearMockSession();
      const req = new Request(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await POST(req);
      expect(res.status).toBe(401); // Will fail auth before parsing JSON
    });

    it('should handle negative contactId', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: -1 },
      });

      const res = await POST(req);
      expect(res.status).toBe(400); // Validation error (positive required)
    });

    it('should handle zero contactId', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'POST',
        userId: testUser.id,
        body: { contactId: 0 },
      });

      const res = await POST(req);
      expect(res.status).toBe(400); // Validation error (positive required)
    });
  });

  describe('DELETE /api/users/:id/contacts', () => {
    it('should delete an existing contact', async () => {
      // Use one of the pre-connected contacts
      const contactToRemove = contacts[0];
      
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: contactToRemove.id },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);

      const data = await getJsonResponse(res);
      expect(data.message).toBe('Contact removed successfully');

      // Verify contact was actually removed
      const updated = await db.user.findUnique({
        where: { id: testUser.id },
        include: { contacts: true },
      });
      expect(updated?.contacts.some(c => c.id === contactToRemove.id)).toBe(false);
    });

    it('should return 401 if not authenticated', async () => {
      clearMockSession();
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: null,
        body: { contactId: contacts[1].id },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('should return 404 when trying to delete from another user (dev mode bypasses auth)', async () => {
      // In test/dev mode, requireSameUser doesn't throw, so it proceeds to check if contact exists
      // Since otherUser has no contacts, it returns 404
      const req = createAuthenticatedRequest(`http://localhost/api/users/${otherUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: contacts[1].id },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(404); // Contact not found (because otherUser has no contacts)
    });

    it('should return 404 if contact does not exist in user\'s contacts', async () => {
      // Use lonelyUser which has never been added as a contact to testUser
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: lonelyUser.id },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(404);

      const data = await getJsonResponse(res);
      expect(data.message).toBe('Contact not found');
    });

    it('should return 400 if contactId is missing', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: {},
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400);

      const data = await getJsonResponse(res);
      expect(data.message).toBe('contactId is required and must be a number');
    });

    it('should return 400 if contactId is not a number', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: 'invalid' },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400);

      const data = await getJsonResponse(res);
      expect(data.message).toBe('contactId is required and must be a number');
    });

    it('should return 400 if trying to remove yourself as contact', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: testUser.id },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400);

      const data = await getJsonResponse(res);
      expect(data.message).toBe('Cannot remove yourself as a contact');
    });

    it('should handle invalid user id in path', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/invalid/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: contacts[1].id },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should handle negative contactId', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: -1 },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(404); // Contact not found
    });

    it('should handle zero contactId', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: 0 },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400); // Cannot remove yourself (if userId is 0) or validation error
    });

    it('should handle non-existent contactId', async () => {
      const req = createAuthenticatedRequest(`http://localhost/api/users/${testUser.id}/contacts`, {
        method: 'DELETE',
        userId: testUser.id,
        body: { contactId: 999999 },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(404);

      const data = await getJsonResponse(res);
      expect(data.message).toBe('Contact not found');
    });
  });
});
