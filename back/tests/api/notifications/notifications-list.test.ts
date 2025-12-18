// tests/api/notifications/notifications-list.test.ts
import { DELETE, GET, PATCH } from '@/app/api/notifications/route';
import { db } from '@/libs/db';
import { NotificationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearMockSession, createAuthenticatedRequest, createRequest, getJsonResponse } from '../../helpers/request';

let testUser: any;
let otherUser: any;
let testInvoice: any;
let notifications: any[] = [];

beforeAll(async () => {
  // Clean up any existing test data
  await db.notification.deleteMany({
    where: {
      user: {
        email: { contains: 'notifications.test.com' },
      },
    },
  });
  await db.invoice.deleteMany({
    where: {
      invoiceNumber: { startsWith: 'NOTIF-TEST-' },
    },
  });
  await db.user.deleteMany({
    where: {
      email: { contains: 'notifications.test.com' },
    },
  });

  // Create test users
  testUser = await db.user.create({
    data: {
      email: 'user1@notifications.test.com',
      password: 'HashedPassword123!',
      name: 'Test',
      surnames: 'User',
    },
  });

  otherUser = await db.user.create({
    data: {
      email: 'user2@notifications.test.com',
      password: 'HashedPassword123!',
      name: 'Other',
      surnames: 'User',
    },
  });

  // Create a test invoice
  testInvoice = await db.invoice.create({
    data: {
      invoiceNumber: 'NOTIF-TEST-001',
      issuerUserId: otherUser.id,
      debtorUserId: testUser.id,
      subject: 'Test Invoice Subject',
      description: 'Test Invoice Description',
      amount: new Decimal('100.00'),
      status: 'PENDING',
      issueDate: new Date(),
      invoicePdfUrl: 'https://example.com/test.pdf',
    },
  });

  // Create multiple notifications for testing pagination and filtering
  const types = [
    NotificationType.INVOICE_ISSUED,
    NotificationType.PAYMENT_DUE,
    NotificationType.PAYMENT_OVERDUE,
    NotificationType.PAYMENT_RECEIVED,
    NotificationType.INVOICE_CANCELED,
  ];

  for (let i = 0; i < 25; i++) {
    const notification = await db.notification.create({
      data: {
        userId: testUser.id,
        invoiceId: testInvoice.id,
        type: types[i % types.length],
        read: i < 10, // First 10 are read
      },
    });
    notifications.push(notification);
  }
});

afterAll(async () => {
  clearMockSession();
  // Clean up
  await db.notification.deleteMany({
    where: {
      user: {
        email: { contains: 'notifications.test.com' },
      },
    },
  });
  await db.invoice.deleteMany({
    where: {
      invoiceNumber: { startsWith: 'NOTIF-TEST-' },
    },
  });
  await db.user.deleteMany({
    where: {
      email: { contains: 'notifications.test.com' },
    },
  });
});

describe('GET /api/notifications', () => {
  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      clearMockSession();
      const request = createRequest('http://localhost:3000/api/notifications');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('List notifications', () => {
    it('should return paginated notifications with default settings', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/notifications',
        { userId: testUser.id }
      );
      const response = await GET(request);
      const data = await getJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.notifications).toHaveLength(20); // Default limit
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
      expect(data.pagination.total).toBe(25);
      expect(data.pagination.totalPages).toBe(2);
      expect(data.unreadCount).toBe(15); // 25 - 10 read
    });

    it('should return second page of notifications', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/notifications?page=2',
        { userId: testUser.id }
      );
      const response = await GET(request);
      const data = await getJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.notifications).toHaveLength(5); // Remaining 5 on second page
      expect(data.pagination.page).toBe(2);
    });

    it('should filter by read status', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/notifications?read=false',
        { userId: testUser.id }
      );
      const response = await GET(request);
      const data = await getJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.pagination.total).toBe(15); // 15 unread
      data.notifications.forEach((n: any) => {
        expect(n.read).toBe(false);
      });
    });

    it('should filter by notification type', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/notifications?type=INVOICE_ISSUED',
        { userId: testUser.id }
      );
      const response = await GET(request);
      const data = await getJsonResponse(response);

      expect(response.status).toBe(200);
      data.notifications.forEach((n: any) => {
        expect(n.type).toBe('INVOICE_ISSUED');
      });
    });

    it('should include message in notification response', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/notifications?limit=1',
        { userId: testUser.id }
      );
      const response = await GET(request);
      const data = await getJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.notifications[0]).toHaveProperty('message');
      expect(data.notifications[0].message).toBeDefined();
    });

    it('should sort by createdAt desc by default', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/notifications?limit=5',
        { userId: testUser.id }
      );
      const response = await GET(request);
      const data = await getJsonResponse(response);

      expect(response.status).toBe(200);
      // Newest notifications first
      for (let i = 1; i < data.notifications.length; i++) {
        const prev = new Date(data.notifications[i - 1].createdAt).getTime();
        const curr = new Date(data.notifications[i].createdAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should sort by read status ascending', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/notifications?sortBy=read&sortOrder=asc&limit=25',
        { userId: testUser.id }
      );
      const response = await GET(request);
      const data = await getJsonResponse(response);

      expect(response.status).toBe(200);
      // Unread (false) should come before read (true)
      const readValues = data.notifications.map((n: any) => n.read);
      const falseIndex = readValues.indexOf(false);
      const trueIndex = readValues.indexOf(true);
      if (falseIndex !== -1 && trueIndex !== -1) {
        expect(falseIndex).toBeLessThan(trueIndex);
      }
    });
  });
});

describe('PATCH /api/notifications', () => {
  let unreadNotification: any;

  beforeAll(async () => {
    // Create a fresh unread notification for this test suite
    unreadNotification = await db.notification.create({
      data: {
        userId: testUser.id,
        invoiceId: testInvoice.id,
        type: NotificationType.INVOICE_ISSUED,
        read: false,
      },
    });
  });

  it('should return 401 when not authenticated', async () => {
    clearMockSession();
    const request = createRequest('http://localhost:3000/api/notifications', {
      method: 'PATCH',
      body: { notificationIds: [1] },
    });
    const response = await PATCH(request);

    expect(response.status).toBe(401);
  });

  it('should mark specific notifications as read', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'PATCH',
        userId: testUser.id,
        body: { notificationIds: [unreadNotification.id] },
      }
    );
    const response = await PATCH(request);
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.message).toBe('Notifications updated successfully');
    expect(data.updatedCount).toBeGreaterThanOrEqual(1);

    // Verify notification is read
    const updated = await db.notification.findUnique({
      where: { id: unreadNotification.id },
    });
    expect(updated?.read).toBe(true);
  });

  it('should mark all notifications as read', async () => {
    // Create some unread notifications first
    await db.notification.createMany({
      data: [
        { userId: testUser.id, invoiceId: testInvoice.id, type: NotificationType.PAYMENT_DUE, read: false },
        { userId: testUser.id, invoiceId: testInvoice.id, type: NotificationType.PAYMENT_DUE, read: false },
      ],
    });

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'PATCH',
        userId: testUser.id,
        body: { markAllAsRead: true },
      }
    );
    const response = await PATCH(request);
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.updatedCount).toBeGreaterThanOrEqual(2);

    // Verify all are read
    const unreadCount = await db.notification.count({
      where: { userId: testUser.id, read: false },
    });
    expect(unreadCount).toBe(0);
  });

  it('should return 400 when neither notificationIds nor markAllAsRead provided', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'PATCH',
        userId: testUser.id,
        body: {},
      }
    );
    const response = await PATCH(request);

    expect(response.status).toBe(400);
  });

  it('should not update notifications belonging to other users', async () => {
    // Create notification for other user
    const otherNotification = await db.notification.create({
      data: {
        userId: otherUser.id,
        invoiceId: testInvoice.id,
        type: NotificationType.INVOICE_ISSUED,
        read: false,
      },
    });

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'PATCH',
        userId: testUser.id, // Logged in as testUser
        body: { notificationIds: [otherNotification.id] },
      }
    );
    const response = await PATCH(request);
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.updatedCount).toBe(0); // Should not update

    // Verify notification is still unread
    const unchanged = await db.notification.findUnique({
      where: { id: otherNotification.id },
    });
    expect(unchanged?.read).toBe(false);

    // Cleanup
    await db.notification.delete({ where: { id: otherNotification.id } });
  });
});

describe('DELETE /api/notifications', () => {
  let notificationsToDelete: any[] = [];

  beforeAll(async () => {
    // Create notifications specifically for delete tests
    for (let i = 0; i < 5; i++) {
      const n = await db.notification.create({
        data: {
          userId: testUser.id,
          invoiceId: testInvoice.id,
          type: NotificationType.INVOICE_ISSUED,
          read: i < 3, // First 3 are read
        },
      });
      notificationsToDelete.push(n);
    }
  });

  it('should return 401 when not authenticated', async () => {
    clearMockSession();
    const request = createRequest('http://localhost:3000/api/notifications', {
      method: 'DELETE',
      body: { notificationIds: [1] },
    });
    const response = await DELETE(request);

    expect(response.status).toBe(401);
  });

  it('should delete specific notifications', async () => {
    const idsToDelete = [notificationsToDelete[3].id, notificationsToDelete[4].id];

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'DELETE',
        userId: testUser.id,
        body: { notificationIds: idsToDelete },
      }
    );
    const response = await DELETE(request);
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.message).toBe('Notifications deleted successfully');
    expect(data.deletedCount).toBe(2);

    // Verify they're deleted
    const remaining = await db.notification.findMany({
      where: { id: { in: idsToDelete } },
    });
    expect(remaining).toHaveLength(0);
  });

  it('should delete all read notifications', async () => {
    // Create some read notifications
    await db.notification.createMany({
      data: [
        { userId: testUser.id, invoiceId: testInvoice.id, type: NotificationType.PAYMENT_DUE, read: true },
        { userId: testUser.id, invoiceId: testInvoice.id, type: NotificationType.PAYMENT_DUE, read: true },
        { userId: testUser.id, invoiceId: testInvoice.id, type: NotificationType.PAYMENT_DUE, read: false },
      ],
    });

    const readCountBefore = await db.notification.count({
      where: { userId: testUser.id, read: true },
    });

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'DELETE',
        userId: testUser.id,
        body: { deleteAllRead: true },
      }
    );
    const response = await DELETE(request);
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.deletedCount).toBeGreaterThanOrEqual(2);

    // Verify all read are deleted
    const readCountAfter = await db.notification.count({
      where: { userId: testUser.id, read: true },
    });
    expect(readCountAfter).toBe(0);
  });

  it('should return 400 when neither notificationIds nor deleteAllRead provided', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'DELETE',
        userId: testUser.id,
        body: {},
      }
    );
    const response = await DELETE(request);

    expect(response.status).toBe(400);
  });

  it('should not delete notifications belonging to other users', async () => {
    // Create notification for other user
    const otherNotification = await db.notification.create({
      data: {
        userId: otherUser.id,
        invoiceId: testInvoice.id,
        type: NotificationType.INVOICE_ISSUED,
        read: true,
      },
    });

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      {
        method: 'DELETE',
        userId: testUser.id,
        body: { notificationIds: [otherNotification.id] },
      }
    );
    const response = await DELETE(request);
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.deletedCount).toBe(0);

    // Verify notification still exists
    const stillExists = await db.notification.findUnique({
      where: { id: otherNotification.id },
    });
    expect(stillExists).not.toBeNull();

    // Cleanup
    await db.notification.delete({ where: { id: otherNotification.id } });
  });
});
