// tests/api/notifications/notification-detail.test.ts
import { DELETE, GET, PATCH } from '@/app/api/notifications/[id]/route';
import { db } from '@/libs/db';
import { NotificationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearMockSession, createAuthenticatedRequest, createRequest, getJsonResponse } from '../../helpers/request';

let testUser: any;
let otherUser: any;
let testInvoice: any;
let testNotification: any;
let otherUserNotification: any;

beforeAll(async () => {
  // Clean up any existing test data
  await db.notification.deleteMany({
    where: {
      user: {
        email: { contains: 'notifdetail.test.com' },
      },
    },
  });
  await db.invoice.deleteMany({
    where: {
      invoiceNumber: { startsWith: 'NOTIF-DETAIL-' },
    },
  });
  await db.user.deleteMany({
    where: {
      email: { contains: 'notifdetail.test.com' },
    },
  });

  // Create test users
  testUser = await db.user.create({
    data: {
      email: 'user1@notifdetail.test.com',
      password: 'HashedPassword123!',
      name: 'Test',
      surnames: 'User',
    },
  });

  otherUser = await db.user.create({
    data: {
      email: 'user2@notifdetail.test.com',
      password: 'HashedPassword123!',
      name: 'Other',
      surnames: 'User',
    },
  });

  // Create a test invoice
  testInvoice = await db.invoice.create({
    data: {
      invoiceNumber: 'NOTIF-DETAIL-001',
      issuerUserId: otherUser.id,
      debtorUserId: testUser.id,
      subject: 'Test Invoice Subject',
      description: 'Test Invoice Description',
      amount: new Decimal('250.00'),
      status: 'PENDING',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      invoicePdfUrl: 'https://example.com/test.pdf',
    },
  });

  // Create test notifications
  testNotification = await db.notification.create({
    data: {
      userId: testUser.id,
      invoiceId: testInvoice.id,
      type: NotificationType.INVOICE_ISSUED,
      read: false,
    },
  });

  otherUserNotification = await db.notification.create({
    data: {
      userId: otherUser.id,
      invoiceId: testInvoice.id,
      type: NotificationType.PAYMENT_RECEIVED,
      read: false,
    },
  });
});

afterAll(async () => {
  clearMockSession();
  // Clean up
  await db.notification.deleteMany({
    where: {
      user: {
        email: { contains: 'notifdetail.test.com' },
      },
    },
  });
  await db.invoice.deleteMany({
    where: {
      invoiceNumber: { startsWith: 'NOTIF-DETAIL-' },
    },
  });
  await db.user.deleteMany({
    where: {
      email: { contains: 'notifdetail.test.com' },
    },
  });
});

// Helper to create params context for route handlers
function createParamsContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/notifications/:id', () => {
  it('should return 401 when not authenticated', async () => {
    clearMockSession();
    const request = createRequest(`http://localhost:3000/api/notifications/${testNotification.id}`);
    const response = await GET(request, createParamsContext(testNotification.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return notification details with message', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${testNotification.id}`,
      { userId: testUser.id }
    );
    const response = await GET(request, createParamsContext(testNotification.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.notification).toBeDefined();
    expect(data.notification.id).toBe(testNotification.id);
    expect(data.notification.userId).toBe(testUser.id);
    expect(data.notification.invoiceId).toBe(testInvoice.id);
    expect(data.notification.type).toBe(NotificationType.INVOICE_ISSUED);
    expect(data.notification.read).toBe(false);
    expect(data.notification.message).toBeDefined();
    expect(data.notification.message).toContain('NOTIF-DETAIL-001');
  });

  it('should return 404 for non-existent notification', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications/999999',
      { userId: testUser.id }
    );
    const response = await GET(request, createParamsContext('999999'));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Notification not found');
  });

  it('should return 403 when accessing other user notification', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${otherUserNotification.id}`,
      { userId: testUser.id }
    );
    const response = await GET(request, createParamsContext(otherUserNotification.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(403);
    expect(data.message).toBe('Forbidden');
  });

  it('should return 400 for invalid notification ID', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications/invalid',
      { userId: testUser.id }
    );
    const response = await GET(request, createParamsContext('invalid'));

    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/notifications/:id', () => {
  let notificationToUpdate: any;

  beforeAll(async () => {
    notificationToUpdate = await db.notification.create({
      data: {
        userId: testUser.id,
        invoiceId: testInvoice.id,
        type: NotificationType.PAYMENT_DUE,
        read: false,
      },
    });
  });

  it('should return 401 when not authenticated', async () => {
    clearMockSession();
    const request = createRequest(`http://localhost:3000/api/notifications/${notificationToUpdate.id}`, {
      method: 'PATCH',
      body: { read: true },
    });
    const response = await PATCH(request, createParamsContext(notificationToUpdate.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should mark notification as read', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${notificationToUpdate.id}`,
      {
        method: 'PATCH',
        userId: testUser.id,
        body: { read: true },
      }
    );
    const response = await PATCH(request, createParamsContext(notificationToUpdate.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.message).toBe('Notification updated successfully');
    expect(data.notification.read).toBe(true);

    // Verify in database
    const updated = await db.notification.findUnique({
      where: { id: notificationToUpdate.id },
    });
    expect(updated?.read).toBe(true);
  });

  it('should mark notification as unread', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${notificationToUpdate.id}`,
      {
        method: 'PATCH',
        userId: testUser.id,
        body: { read: false },
      }
    );
    const response = await PATCH(request, createParamsContext(notificationToUpdate.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.notification.read).toBe(false);
  });

  it('should return 404 for non-existent notification', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications/999999',
      {
        method: 'PATCH',
        userId: testUser.id,
        body: { read: true },
      }
    );
    const response = await PATCH(request, createParamsContext('999999'));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Notification not found');
  });

  it('should return 403 when updating other user notification', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${otherUserNotification.id}`,
      {
        method: 'PATCH',
        userId: testUser.id,
        body: { read: true },
      }
    );
    const response = await PATCH(request, createParamsContext(otherUserNotification.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(403);
    expect(data.message).toBe('Forbidden');
  });

  it('should return 400 for missing read field', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${notificationToUpdate.id}`,
      {
        method: 'PATCH',
        userId: testUser.id,
        body: {},
      }
    );
    const response = await PATCH(request, createParamsContext(notificationToUpdate.id.toString()));

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid read value', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${notificationToUpdate.id}`,
      {
        method: 'PATCH',
        userId: testUser.id,
        body: { read: 'yes' },
      }
    );
    const response = await PATCH(request, createParamsContext(notificationToUpdate.id.toString()));

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/notifications/:id', () => {
  let notificationToDelete: any;

  beforeAll(async () => {
    notificationToDelete = await db.notification.create({
      data: {
        userId: testUser.id,
        invoiceId: testInvoice.id,
        type: NotificationType.INVOICE_CANCELED,
        read: false,
      },
    });
  });

  it('should return 401 when not authenticated', async () => {
    clearMockSession();
    const request = createRequest(`http://localhost:3000/api/notifications/${notificationToDelete.id}`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, createParamsContext(notificationToDelete.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when deleting other user notification', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${otherUserNotification.id}`,
      {
        method: 'DELETE',
        userId: testUser.id,
      }
    );
    const response = await DELETE(request, createParamsContext(otherUserNotification.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(403);
    expect(data.message).toBe('Forbidden');
  });

  it('should delete notification successfully', async () => {
    const request = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${notificationToDelete.id}`,
      {
        method: 'DELETE',
        userId: testUser.id,
      }
    );
    const response = await DELETE(request, createParamsContext(notificationToDelete.id.toString()));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.message).toBe('Notification deleted successfully');

    // Verify in database
    const deleted = await db.notification.findUnique({
      where: { id: notificationToDelete.id },
    });
    expect(deleted).toBeNull();
  });

  it('should return 404 for non-existent notification', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications/999999',
      {
        method: 'DELETE',
        userId: testUser.id,
      }
    );
    const response = await DELETE(request, createParamsContext('999999'));
    const data = await getJsonResponse(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Notification not found');
  });

  it('should return 400 for invalid notification ID', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications/invalid',
      {
        method: 'DELETE',
        userId: testUser.id,
      }
    );
    const response = await DELETE(request, createParamsContext('invalid'));

    expect(response.status).toBe(400);
  });
});
