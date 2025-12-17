import { Invoice, NotificationType, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import {
    buildNotificationMessage,
    formatNotificationResponse,
    NotificationContext,
} from '../../src/libs/notifications';

// Mock db for functions that use it
vi.mock('../../src/libs/db', () => ({
  db: {
    notification: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe('Notification Utility Functions', () => {
  describe('buildNotificationMessage', () => {
    const baseContext: NotificationContext = {
      invoiceNumber: 'INV-2024-001',
      issuerName: 'John Doe',
      debtorName: 'Jane Smith',
      amount: '100.00',
      currency: 'EUR',
      dueDate: '2024-12-31',
    };

    it('should build INVOICE_ISSUED message correctly', () => {
      const message = buildNotificationMessage(NotificationType.INVOICE_ISSUED, baseContext);
      expect(message).toBe('New invoice INV-2024-001 for 100.00 EUR has been issued to you by John Doe.');
    });

    it('should build PAYMENT_DUE message correctly', () => {
      const message = buildNotificationMessage(NotificationType.PAYMENT_DUE, baseContext);
      expect(message).toBe('Payment for invoice INV-2024-001 (100.00 EUR) is due on 2024-12-31.');
    });

    it('should build PAYMENT_OVERDUE message correctly', () => {
      const message = buildNotificationMessage(NotificationType.PAYMENT_OVERDUE, baseContext);
      expect(message).toBe('Invoice INV-2024-001 (100.00 EUR) is overdue. Please make payment as soon as possible.');
    });

    it('should build PAYMENT_RECEIVED message correctly', () => {
      const message = buildNotificationMessage(NotificationType.PAYMENT_RECEIVED, baseContext);
      expect(message).toBe('Payment of 100.00 EUR for invoice INV-2024-001 has been received from Jane Smith.');
    });

    it('should build INVOICE_CANCELED message correctly', () => {
      const message = buildNotificationMessage(NotificationType.INVOICE_CANCELED, baseContext);
      expect(message).toBe('Invoice INV-2024-001 (100.00 EUR) has been canceled by John Doe.');
    });

    it('should handle missing optional context values', () => {
      const minimalContext: NotificationContext = {
        invoiceNumber: 'INV-001',
      };
      const message = buildNotificationMessage(NotificationType.INVOICE_ISSUED, minimalContext);
      expect(message).toContain('INV-001');
    });

    it('should format amount without currency when currency not provided', () => {
      const contextWithoutCurrency: NotificationContext = {
        invoiceNumber: 'INV-001',
        amount: '50.00',
      };
      const message = buildNotificationMessage(NotificationType.PAYMENT_RECEIVED, contextWithoutCurrency);
      expect(message).toContain('50.00');
      expect(message).not.toContain('EUR');
    });

    it('should uppercase currency code', () => {
      const contextWithLowerCurrency: NotificationContext = {
        ...baseContext,
        currency: 'usd',
      };
      const message = buildNotificationMessage(NotificationType.INVOICE_ISSUED, contextWithLowerCurrency);
      expect(message).toContain('USD');
    });
  });

  describe('formatNotificationResponse', () => {
    const mockIssuerUser: User = {
      id: 1,
      email: 'issuer@test.com',
      password: 'hashedPassword',
      name: 'John',
      surnames: 'Doe',
      phone: '+1234567890',
      country: 'US',
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockDebtorUser: User = {
      id: 2,
      email: 'debtor@test.com',
      password: 'hashedPassword',
      name: 'Jane',
      surnames: 'Smith',
      phone: '+0987654321',
      country: 'UK',
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockInvoice: Invoice & { issuerUser: User; debtorUser: User } = {
      id: 1,
      invoiceNumber: 'INV-2024-TEST',
      issuerUserId: 1,
      debtorUserId: 2,
      subject: 'Test Invoice',
      description: 'Test Description',
      amount: new Decimal('250.00'),
      status: 'PENDING',
      issueDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15'),
      invoicePdfUrl: 'https://example.com/invoice.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
      issuerUser: mockIssuerUser,
      debtorUser: mockDebtorUser,
    };

    const mockNotification = {
      id: 1,
      userId: 2,
      invoiceId: 1,
      type: NotificationType.INVOICE_ISSUED,
      read: false,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      invoice: mockInvoice,
    };

    it('should format notification response with all fields', () => {
      const result = formatNotificationResponse(mockNotification);

      expect(result.id).toBe(1);
      expect(result.userId).toBe(2);
      expect(result.invoiceId).toBe(1);
      expect(result.type).toBe(NotificationType.INVOICE_ISSUED);
      expect(result.read).toBe(false);
      expect(result.createdAt).toEqual(mockNotification.createdAt);
    });

    it('should build message with issuer and debtor names', () => {
      const result = formatNotificationResponse(mockNotification);

      expect(result.message).toContain('John Doe');
      expect(result.message).toContain('INV-2024-TEST');
    });

    it('should include amount in message', () => {
      const result = formatNotificationResponse(mockNotification);

      expect(result.message).toContain('250');
    });

    it('should format PAYMENT_RECEIVED notification correctly', () => {
      const paymentNotification = {
        ...mockNotification,
        type: NotificationType.PAYMENT_RECEIVED,
        userId: 1, // Issuer receives the notification
      };
      const result = formatNotificationResponse(paymentNotification);

      expect(result.message).toContain('Jane Smith');
      expect(result.message).toContain('received');
    });

    it('should handle read=true', () => {
      const readNotification = {
        ...mockNotification,
        read: true,
      };
      const result = formatNotificationResponse(readNotification);

      expect(result.read).toBe(true);
    });

    it('should format INVOICE_CANCELED notification correctly', () => {
      const canceledNotification = {
        ...mockNotification,
        type: NotificationType.INVOICE_CANCELED,
      };
      const result = formatNotificationResponse(canceledNotification);

      expect(result.message).toContain('canceled');
      expect(result.message).toContain('John Doe');
    });

    it('should handle invoice without dueDate', () => {
      const notificationWithoutDueDate = {
        ...mockNotification,
        invoice: {
          ...mockInvoice,
          dueDate: null,
        },
      };
      const result = formatNotificationResponse(notificationWithoutDueDate);

      // Should still work, just without dueDate in message
      expect(result.id).toBe(1);
      expect(result.message).toBeDefined();
    });
  });
});
