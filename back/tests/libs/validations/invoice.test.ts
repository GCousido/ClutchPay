// tests/libs/validations/invoice.test.ts
import {
    invoiceCreateSchema,
    invoiceListQuerySchema,
    invoiceStatusUpdateSchema,
    invoiceUpdateSchema,
} from '@/libs/validations/invoice';
import { InvoiceStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('Invoice Validations', () => {
  describe('invoiceCreateSchema', () => {
    const validInvoice = {
      invoiceNumber: 'INV-2024-001',
      issuerUserId: 1,
      debtorUserId: 2,
      subject: 'Web Development Services',
      description: 'Full stack web development for company website including frontend and backend',
      amount: 1500.00,
      issueDate: '2024-01-15T10:00:00Z',
      invoicePdf: 'data:application/pdf;base64,JVBERi0xLjQKJdP...',
    };

    describe('invoiceNumber validation', () => {
      it('should accept valid invoice number', () => {
        const result = invoiceCreateSchema.safeParse(validInvoice);
        expect(result.success).toBe(true);
      });

      it('should accept invoice number with dashes', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoiceNumber: 'INV-2024-001-A',
        });
        expect(result.success).toBe(true);
      });

      it('should reject empty invoice number', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoiceNumber: '',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Invoice number is required');
        }
      });

      it('should reject invoice number exceeding 50 characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoiceNumber: 'A'.repeat(51),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('50 characters');
        }
      });

      it('should reject invoice number with lowercase letters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoiceNumber: 'inv-2024-001',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('uppercase letters, numbers and dashes');
        }
      });

      it('should reject invoice number with special characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoiceNumber: 'INV_2024#001',
        });
        expect(result.success).toBe(false);
      });

      it('should reject invoice number with spaces', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoiceNumber: 'INV 2024 001',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('user ID validation', () => {
      it('should accept valid issuer and debtor IDs', () => {
        const result = invoiceCreateSchema.safeParse(validInvoice);
        expect(result.success).toBe(true);
      });

      it('should reject when issuer and debtor are the same', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issuerUserId: 1,
          debtorUserId: 1,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Issuer and debtor cannot be the same');
        }
      });

      it('should reject negative issuer ID', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issuerUserId: -1,
        });
        expect(result.success).toBe(false);
      });

      it('should reject zero debtor ID', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          debtorUserId: 0,
        });
        expect(result.success).toBe(false);
      });

      it('should reject non-integer issuer ID', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issuerUserId: 1.5,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('subject validation', () => {
      it('should accept valid subject', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          subject: 'Valid Subject Here',
        });
        expect(result.success).toBe(true);
      });

      it('should reject subject with less than 5 characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          subject: 'Test',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 5 characters');
        }
      });

      it('should reject subject exceeding 500 characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          subject: 'A'.repeat(501),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('500 characters');
        }
      });

      it('should trim whitespace from subject', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          subject: '  Valid Subject  ',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.subject).toBe('Valid Subject');
        }
      });
    });

    describe('description validation', () => {
      it('should accept valid description', () => {
        const result = invoiceCreateSchema.safeParse(validInvoice);
        expect(result.success).toBe(true);
      });

      it('should reject description with less than 10 characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          description: 'Short',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 10 characters');
        }
      });

      it('should reject description exceeding 5000 characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          description: 'A'.repeat(5001),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('5000 characters');
        }
      });

      it('should accept description with exactly 10 characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          description: 'A'.repeat(10),
        });
        expect(result.success).toBe(true);
      });

      it('should accept description with exactly 5000 characters', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          description: 'A'.repeat(5000),
        });
        expect(result.success).toBe(true);
      });
    });

    describe('amount validation', () => {
      it('should accept valid decimal amount', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: 99.99,
        });
        expect(result.success).toBe(true);
      });

      it('should accept integer amount', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: 100,
        });
        expect(result.success).toBe(true);
      });

      it('should accept string amount and parse it', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: '150.50',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.amount).toBe(150.50);
        }
      });

      it('should reject zero amount', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: 0,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('greater than zero');
        }
      });

      it('should reject negative amount', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: -100,
        });
        expect(result.success).toBe(false);
      });

      it('should reject amount with more than 2 decimal places', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: 99.999,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('2 decimal places');
        }
      });

      it('should reject amount exceeding maximum', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: 100_000_000,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('99,999,999.99');
        }
      });

      it('should accept maximum valid amount', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: 99_999_999.99,
        });
        expect(result.success).toBe(true);
      });

      it('should accept small valid amount', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          amount: 0.01,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('date validation', () => {
      it('should accept valid issueDate', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issueDate: '2024-01-15T10:00:00Z',
        });
        expect(result.success).toBe(true);
      });

      it('should reject future issueDate', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issueDate: futureDate.toISOString(),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('cannot be in the future');
        }
      });

      it('should accept valid dueDate after issueDate', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issueDate: '2024-01-15T10:00:00Z',
          dueDate: '2024-02-15T10:00:00Z',
        });
        expect(result.success).toBe(true);
      });

      it('should reject dueDate before issueDate', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issueDate: '2024-02-15T10:00:00Z',
          dueDate: '2024-01-15T10:00:00Z',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Due date must be after');
        }
      });

      it('should accept null dueDate', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          dueDate: null,
        });
        expect(result.success).toBe(true);
      });

      it('should accept missing dueDate', () => {
        const { dueDate, ...invoiceWithoutDueDate } = validInvoice;
        const result = invoiceCreateSchema.safeParse(invoiceWithoutDueDate);
        expect(result.success).toBe(true);
      });

      it('should reject invalid date format', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          issueDate: 'not-a-date',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Invalid date format');
        }
      });
    });

    describe('PDF validation', () => {
      it('should accept valid base64 PDF', () => {
        const result = invoiceCreateSchema.safeParse(validInvoice);
        expect(result.success).toBe(true);
      });

      it('should reject PDF without proper prefix', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoicePdf: 'JVBERi0xLjQKJdP...', // Missing data: prefix
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('data:application/pdf;base64');
        }
      });

      it('should reject empty PDF', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoicePdf: '',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('PDF is required');
        }
      });

      it('should reject non-PDF base64 data', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          invoicePdf: 'data:image/png;base64,iVBORw0KGgo...',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('status validation', () => {
      it('should default status to PENDING', () => {
        const result = invoiceCreateSchema.safeParse(validInvoice);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe(InvoiceStatus.PENDING);
        }
      });

      it('should accept explicit PENDING status', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          status: InvoiceStatus.PENDING,
        });
        expect(result.success).toBe(true);
      });

      it('should accept PAID status', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          status: InvoiceStatus.PAID,
        });
        expect(result.success).toBe(true);
      });

      it('should accept OVERDUE status', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          status: InvoiceStatus.OVERDUE,
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid status', () => {
        const result = invoiceCreateSchema.safeParse({
          ...validInvoice,
          status: 'INVALID',
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('invoiceUpdateSchema', () => {
    it('should accept valid update with subject only', () => {
      const result = invoiceUpdateSchema.safeParse({
        subject: 'Updated Subject',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with description only', () => {
      const result = invoiceUpdateSchema.safeParse({
        description: 'Updated description that is long enough',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with amount only', () => {
      const result = invoiceUpdateSchema.safeParse({
        amount: 200.00,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with multiple fields', () => {
      const result = invoiceUpdateSchema.safeParse({
        subject: 'Updated Subject',
        description: 'Updated description that is long enough',
        amount: 200.00,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty update', () => {
      const result = invoiceUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least one field');
      }
    });

    it('should reject invalid subject in update', () => {
      const result = invoiceUpdateSchema.safeParse({
        subject: 'Hi', // Too short
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid amount in update', () => {
      const result = invoiceUpdateSchema.safeParse({
        amount: -50,
      });
      expect(result.success).toBe(false);
    });

    it('should accept status update', () => {
      const result = invoiceUpdateSchema.safeParse({
        status: InvoiceStatus.PAID,
      });
      expect(result.success).toBe(true);
    });

    it('should accept dueDate update', () => {
      const result = invoiceUpdateSchema.safeParse({
        dueDate: '2024-12-31T23:59:59Z',
      });
      expect(result.success).toBe(true);
    });

    it('should accept null dueDate to clear it', () => {
      const result = invoiceUpdateSchema.safeParse({
        dueDate: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept PDF update with valid format', () => {
      const result = invoiceUpdateSchema.safeParse({
        invoicePdf: 'data:application/pdf;base64,JVBERi0xLjQK...',
      });
      expect(result.success).toBe(true);
    });

    it('should reject PDF update with invalid format', () => {
      const result = invoiceUpdateSchema.safeParse({
        invoicePdf: 'invalid-pdf-data',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invoiceStatusUpdateSchema', () => {
    it('should accept PENDING status', () => {
      const result = invoiceStatusUpdateSchema.safeParse({
        status: InvoiceStatus.PENDING,
      });
      expect(result.success).toBe(true);
    });

    it('should accept PAID status', () => {
      const result = invoiceStatusUpdateSchema.safeParse({
        status: InvoiceStatus.PAID,
      });
      expect(result.success).toBe(true);
    });

    it('should accept OVERDUE status', () => {
      const result = invoiceStatusUpdateSchema.safeParse({
        status: InvoiceStatus.OVERDUE,
      });
      expect(result.success).toBe(true);
    });

    it('should accept CANCELED status', () => {
      const result = invoiceStatusUpdateSchema.safeParse({
        status: InvoiceStatus.CANCELED,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing status', () => {
      const result = invoiceStatusUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const result = invoiceStatusUpdateSchema.safeParse({
        status: 'INVALID_STATUS',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invoiceListQuerySchema', () => {
    describe('role validation', () => {
      it('should default role to "issuer"', () => {
        const result = invoiceListQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.role).toBe('issuer');
        }
      });

      it('should accept "issuer" role', () => {
        const result = invoiceListQuerySchema.safeParse({ role: 'issuer' });
        expect(result.success).toBe(true);
      });

      it('should accept "debtor" role', () => {
        const result = invoiceListQuerySchema.safeParse({ role: 'debtor' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid role', () => {
        const result = invoiceListQuerySchema.safeParse({ role: 'admin' });
        expect(result.success).toBe(false);
      });
    });

    describe('status filter validation', () => {
      it('should accept status filter (case insensitive)', () => {
        const result = invoiceListQuerySchema.safeParse({ status: 'pending' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe(InvoiceStatus.PENDING);
        }
      });

      it('should accept uppercase status', () => {
        const result = invoiceListQuerySchema.safeParse({ status: 'PAID' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid status', () => {
        const result = invoiceListQuerySchema.safeParse({ status: 'INVALID' });
        expect(result.success).toBe(false);
      });

      it('should reject empty status string', () => {
        // Empty string is not a valid status and gets rejected after toUpperCase transform
        const result = invoiceListQuerySchema.safeParse({ status: '' });
        expect(result.success).toBe(false);
      });
    });

    describe('subject filter validation', () => {
      it('should accept subject filter', () => {
        const result = invoiceListQuerySchema.safeParse({ subject: 'development' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.subject).toBe('development');
        }
      });

      it('should reject empty subject string', () => {
        // Subject has min(1) validation, so empty string is rejected
        const result = invoiceListQuerySchema.safeParse({ subject: '' });
        expect(result.success).toBe(false);
      });

      it('should trim subject filter', () => {
        const result = invoiceListQuerySchema.safeParse({ subject: '  test  ' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.subject).toBe('test');
        }
      });
    });

    describe('amount range validation', () => {
      it('should accept valid minAmount', () => {
        const result = invoiceListQuerySchema.safeParse({ minAmount: '100' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.minAmount).toBe(100);
        }
      });

      it('should accept valid maxAmount', () => {
        const result = invoiceListQuerySchema.safeParse({ maxAmount: '5000' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxAmount).toBe(5000);
        }
      });

      it('should accept valid amount range', () => {
        const result = invoiceListQuerySchema.safeParse({
          minAmount: '100',
          maxAmount: '5000',
        });
        expect(result.success).toBe(true);
      });

      it('should reject when minAmount > maxAmount', () => {
        const result = invoiceListQuerySchema.safeParse({
          minAmount: '5000',
          maxAmount: '100',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Minimum amount cannot be greater than maximum');
        }
      });

      it('should reject empty amount strings', () => {
        // Empty strings are not valid numbers after preprocessing
        const result = invoiceListQuerySchema.safeParse({ minAmount: '', maxAmount: '' });
        expect(result.success).toBe(false);
      });

      it('should reject non-numeric amount strings', () => {
        // Non-numeric strings fail the number validation
        const result = invoiceListQuerySchema.safeParse({ minAmount: 'abc' });
        expect(result.success).toBe(false);
      });
    });

    describe('date range validation', () => {
      it('should accept valid issueDateFrom', () => {
        const result = invoiceListQuerySchema.safeParse({
          issueDateFrom: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(true);
      });

      it('should accept valid issueDateTo', () => {
        const result = invoiceListQuerySchema.safeParse({
          issueDateTo: '2024-12-31T23:59:59Z',
        });
        expect(result.success).toBe(true);
      });

      it('should accept valid issue date range', () => {
        const result = invoiceListQuerySchema.safeParse({
          issueDateFrom: '2024-01-01T00:00:00Z',
          issueDateTo: '2024-12-31T23:59:59Z',
        });
        expect(result.success).toBe(true);
      });

      it('should reject when issueDateFrom > issueDateTo', () => {
        const result = invoiceListQuerySchema.safeParse({
          issueDateFrom: '2024-12-31T23:59:59Z',
          issueDateTo: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Issue start date cannot be after');
        }
      });

      it('should accept valid due date range', () => {
        const result = invoiceListQuerySchema.safeParse({
          dueDateFrom: '2024-01-01T00:00:00Z',
          dueDateTo: '2024-12-31T23:59:59Z',
        });
        expect(result.success).toBe(true);
      });

      it('should reject when dueDateFrom > dueDateTo', () => {
        const result = invoiceListQuerySchema.safeParse({
          dueDateFrom: '2024-12-31T23:59:59Z',
          dueDateTo: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Due start date cannot be after');
        }
      });

      it('should reject invalid date format', () => {
        const result = invoiceListQuerySchema.safeParse({
          issueDateFrom: 'invalid-date',
        });
        expect(result.success).toBe(false);
      });

      it('should reject empty date strings', () => {
        // Empty strings fail datetime validation
        const result = invoiceListQuerySchema.safeParse({
          issueDateFrom: '',
          issueDateTo: '',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('sorting validation', () => {
      it('should default sortBy to "issueDate"', () => {
        const result = invoiceListQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sortBy).toBe('issueDate');
        }
      });

      it('should default sortOrder to "desc"', () => {
        const result = invoiceListQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sortOrder).toBe('desc');
        }
      });

      it('should accept "dueDate" as sortBy', () => {
        const result = invoiceListQuerySchema.safeParse({ sortBy: 'dueDate' });
        expect(result.success).toBe(true);
      });

      it('should accept "createdAt" as sortBy', () => {
        const result = invoiceListQuerySchema.safeParse({ sortBy: 'createdAt' });
        expect(result.success).toBe(true);
      });

      it('should accept "asc" as sortOrder', () => {
        const result = invoiceListQuerySchema.safeParse({ sortOrder: 'asc' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid sortBy', () => {
        const result = invoiceListQuerySchema.safeParse({ sortBy: 'amount' });
        expect(result.success).toBe(false);
      });

      it('should reject invalid sortOrder', () => {
        const result = invoiceListQuerySchema.safeParse({ sortOrder: 'random' });
        expect(result.success).toBe(false);
      });
    });

    describe('combined filters', () => {
      it('should accept all valid filters combined', () => {
        const result = invoiceListQuerySchema.safeParse({
          role: 'issuer',
          status: 'PENDING',
          subject: 'development',
          minAmount: '100',
          maxAmount: '5000',
          issueDateFrom: '2024-01-01T00:00:00Z',
          issueDateTo: '2024-12-31T23:59:59Z',
          dueDateFrom: '2024-02-01T00:00:00Z',
          dueDateTo: '2024-12-31T23:59:59Z',
          sortBy: 'issueDate',
          sortOrder: 'desc',
        });
        expect(result.success).toBe(true);
      });
    });
  });
});
