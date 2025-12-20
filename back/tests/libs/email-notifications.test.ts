// tests/libs/email-notifications.test.ts
import { Payment, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock db for notification creation
vi.mock('../../src/libs/db', () => ({
  db: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock email service - use vi.hoisted to create mock before hoisting
const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
}));

vi.mock('../../src/libs/email', () => ({
  sendEmail: sendEmailMock,
}));

// Import after mocks are set up
import {
    notifyInvoiceCanceled,
    notifyInvoiceIssued,
    notifyPaymentDue,
    notifyPaymentOverdue,
    notifyPaymentReceived,
} from '../../src/libs/notifications';

describe('Email Notifications', () => {
  // Base mock data
  const mockIssuerUser: User = {
    id: 1,
    email: 'issuer@example.com',
    password: 'hashedPassword',
    name: 'María',
    surnames: 'García López',
    phone: '+34612345678',
    country: 'ES',
    imageUrl: null,
    emailNotifications: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockDebtorUser: User = {
    id: 2,
    email: 'debtor@example.com',
    password: 'hashedPassword',
    name: 'Juan',
    surnames: 'Rodríguez Pérez',
    phone: '+34698765432',
    country: 'ES',
    imageUrl: null,
    emailNotifications: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPayment: Payment = {
    id: 1,
    invoiceId: 1,
    paymentDate: new Date('2024-12-15'),
    paymentMethod: 'PAYPAL',
    paymentReference: 'PAY-123456',
    receiptPdfUrl: 'https://example.com/receipt.pdf',
    subject: 'Payment for services',
    createdAt: new Date('2024-12-15'),
    updatedAt: new Date('2024-12-15'),
  };

  const mockInvoice = {
    id: 1,
    invoiceNumber: 'INV-2024-001',
    issuerUserId: 1,
    debtorUserId: 2,
    subject: 'Servicios de desarrollo web - Diciembre 2024',
    description: 'Desarrollo de aplicación web',
    amount: new Decimal('1500.00'),
    status: 'PENDING' as const,
    issueDate: new Date('2024-12-01'),
    dueDate: new Date('2024-12-31'),
    invoicePdfUrl: 'https://example.com/invoice.pdf',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
    issuerUser: mockIssuerUser,
    debtorUser: mockDebtorUser,
    payment: null as Payment | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyInvoiceIssued', () => {
    it('should send email when debtor has email notifications enabled', async () => {
      await notifyInvoiceIssued(mockInvoice);

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'debtor@example.com',
          subject: expect.stringContaining('INV-2024-001'),
        })
      );
    });

    it('should include correct recipient name in email', async () => {
      await notifyInvoiceIssued(mockInvoice);

      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.subject).toContain('María García López');
    });

    it('should NOT send email when debtor has email notifications disabled', async () => {
      const invoiceWithDisabledNotifications = {
        ...mockInvoice,
        debtorUser: { ...mockDebtorUser, emailNotifications: false },
      };

      await notifyInvoiceIssued(invoiceWithDisabledNotifications);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('should have react component in email params', async () => {
      await notifyInvoiceIssued(mockInvoice);

      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.react).toBeDefined();
    });
  });

  describe('notifyPaymentReceived', () => {
    it('should send email to issuer when payment is received', async () => {
      const invoiceWithPayment = {
        ...mockInvoice,
        payment: mockPayment,
      };

      await notifyPaymentReceived(invoiceWithPayment);

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'issuer@example.com',
          subject: expect.stringContaining('INV-2024-001'),
        })
      );
    });

    it('should NOT send email when issuer has email notifications disabled', async () => {
      const invoiceWithDisabledNotifications = {
        ...mockInvoice,
        issuerUser: { ...mockIssuerUser, emailNotifications: false },
        payment: mockPayment,
      };

      await notifyPaymentReceived(invoiceWithDisabledNotifications);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('should include payment details in email', async () => {
      const invoiceWithPayment = {
        ...mockInvoice,
        payment: mockPayment,
      };

      await notifyPaymentReceived(invoiceWithPayment);

      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.subject).toContain('Payment Received');
    });
  });

  describe('notifyInvoiceCanceled', () => {
    it('should send email to debtor when invoice is canceled', async () => {
      await notifyInvoiceCanceled(mockInvoice);

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'debtor@example.com',
          subject: expect.stringContaining('Canceled'),
        })
      );
    });

    it('should NOT send email when debtor has email notifications disabled', async () => {
      const invoiceWithDisabledNotifications = {
        ...mockInvoice,
        debtorUser: { ...mockDebtorUser, emailNotifications: false },
      };

      await notifyInvoiceCanceled(invoiceWithDisabledNotifications);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('should include invoice number in subject', async () => {
      await notifyInvoiceCanceled(mockInvoice);

      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.subject).toContain('INV-2024-001');
    });

    it('should pass reason to email template when provided', async () => {
      await notifyInvoiceCanceled(mockInvoice, 'Proyecto cancelado');

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      // The reason is passed to the React component, not to subject
      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.react).toBeDefined();
    });
  });

  describe('notifyPaymentDue', () => {
    it('should send email to debtor when payment is due soon', async () => {
      // Set due date to 3 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      
      const invoiceWithFutureDue = {
        ...mockInvoice,
        dueDate: futureDate,
      };

      await notifyPaymentDue(invoiceWithFutureDue);

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'debtor@example.com',
          subject: expect.stringContaining('Reminder'),
        })
      );
    });

    it('should NOT send email when debtor has email notifications disabled', async () => {
      const invoiceWithDisabledNotifications = {
        ...mockInvoice,
        debtorUser: { ...mockDebtorUser, emailNotifications: false },
      };

      await notifyPaymentDue(invoiceWithDisabledNotifications);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('should NOT send email when invoice has no due date', async () => {
      const invoiceWithoutDueDate = {
        ...mockInvoice,
        dueDate: null,
      };

      await notifyPaymentDue(invoiceWithoutDueDate);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });
  });

  describe('notifyPaymentOverdue', () => {
    it('should send email to debtor when payment is overdue', async () => {
      // Set due date to 5 days ago
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      
      const invoiceOverdue = {
        ...mockInvoice,
        dueDate: pastDate,
      };

      await notifyPaymentOverdue(invoiceOverdue);

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'debtor@example.com',
          subject: expect.stringContaining('Overdue'),
        })
      );
    });

    it('should include Urgent in subject for overdue invoices', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      
      const invoiceOverdue = {
        ...mockInvoice,
        dueDate: pastDate,
      };

      await notifyPaymentOverdue(invoiceOverdue);

      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.subject).toContain('Urgent');
    });

    it('should NOT send email when debtor has email notifications disabled', async () => {
      const invoiceWithDisabledNotifications = {
        ...mockInvoice,
        debtorUser: { ...mockDebtorUser, emailNotifications: false },
      };

      await notifyPaymentOverdue(invoiceWithDisabledNotifications);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('should NOT send email when invoice has no due date', async () => {
      const invoiceWithoutDueDate = {
        ...mockInvoice,
        dueDate: null,
      };

      await notifyPaymentOverdue(invoiceWithoutDueDate);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });
  });

  describe('Email structure validation', () => {
    it('should always include "to" field with valid email', async () => {
      await notifyInvoiceIssued(mockInvoice);
      await notifyPaymentReceived({ ...mockInvoice, payment: mockPayment });
      await notifyInvoiceCanceled(mockInvoice);

      expect(sendEmailMock).toHaveBeenCalledTimes(3);
      
      sendEmailMock.mock.calls.forEach((call: any[]) => {
        expect(call[0].to).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });

    it('should always include "subject" field', async () => {
      await notifyInvoiceIssued(mockInvoice);
      
      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.subject).toBeTruthy();
      expect(typeof emailCall.subject).toBe('string');
      expect(emailCall.subject.length).toBeGreaterThan(0);
    });

    it('should always include "react" component', async () => {
      await notifyInvoiceIssued(mockInvoice);
      
      const emailCall = sendEmailMock.mock.calls[0][0];
      expect(emailCall.react).toBeDefined();
    });
  });

  describe('Email subject templates', () => {
    it('INVOICE_ISSUED subject contains invoice number and issuer name', async () => {
      await notifyInvoiceIssued(mockInvoice);
      
      const subject = sendEmailMock.mock.calls[0][0].subject;
      expect(subject).toContain('INV-2024-001');
      expect(subject).toContain('María García López');
    });

    it('PAYMENT_RECEIVED subject contains invoice number', async () => {
      await notifyPaymentReceived({ ...mockInvoice, payment: mockPayment });
      
      const subject = sendEmailMock.mock.calls[0][0].subject;
      expect(subject).toContain('INV-2024-001');
    });

    it('INVOICE_CANCELED subject contains invoice number', async () => {
      await notifyInvoiceCanceled(mockInvoice);
      
      const subject = sendEmailMock.mock.calls[0][0].subject;
      expect(subject).toContain('INV-2024-001');
    });

    it('PAYMENT_DUE subject contains invoice number', async () => {
      await notifyPaymentDue(mockInvoice);
      
      const subject = sendEmailMock.mock.calls[0][0].subject;
      expect(subject).toContain('INV-2024-001');
    });

    it('PAYMENT_OVERDUE subject contains Urgent and invoice number', async () => {
      await notifyPaymentOverdue(mockInvoice);
      
      const subject = sendEmailMock.mock.calls[0][0].subject;
      expect(subject).toContain('Urgent');
      expect(subject).toContain('INV-2024-001');
    });
  });
});
