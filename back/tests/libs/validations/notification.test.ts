import { describe, expect, it } from 'vitest';
import {
    notificationBulkDeleteSchema,
    notificationBulkReadSchema,
    notificationIdParamSchema,
    notificationListQuerySchema,
    notificationUpdateSchema,
} from '../../../src/libs/validations/notification';

describe('Notification Validation Schemas', () => {
  describe('notificationListQuerySchema', () => {
    describe('pagination', () => {
      it('should use default values when no parameters provided', () => {
        const result = notificationListQuerySchema.parse({});
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
        expect(result.sortBy).toBe('createdAt');
        expect(result.sortOrder).toBe('desc');
      });

      it('should accept valid page number', () => {
        const result = notificationListQuerySchema.parse({ page: '5' });
        expect(result.page).toBe(5);
      });

      it('should reject non-positive page number', () => {
        expect(() => notificationListQuerySchema.parse({ page: '0' })).toThrow();
        expect(() => notificationListQuerySchema.parse({ page: '-1' })).toThrow();
      });

      it('should accept valid limit', () => {
        const result = notificationListQuerySchema.parse({ limit: '50' });
        expect(result.limit).toBe(50);
      });

      it('should reject limit exceeding 100', () => {
        expect(() => notificationListQuerySchema.parse({ limit: '101' })).toThrow();
      });

      it('should reject limit less than 1', () => {
        expect(() => notificationListQuerySchema.parse({ limit: '0' })).toThrow();
      });
    });

    describe('read filter', () => {
      it('should parse read=true correctly', () => {
        const result = notificationListQuerySchema.parse({ read: 'true' });
        expect(result.read).toBe(true);
      });

      it('should parse read=false correctly', () => {
        const result = notificationListQuerySchema.parse({ read: 'false' });
        expect(result.read).toBe(false);
      });

      it('should leave read undefined when not provided', () => {
        const result = notificationListQuerySchema.parse({});
        expect(result.read).toBeUndefined();
      });
    });

    describe('type filter', () => {
      it('should accept valid notification types', () => {
        const types = ['INVOICE_ISSUED', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'PAYMENT_RECEIVED', 'INVOICE_CANCELED'];
        for (const type of types) {
          const result = notificationListQuerySchema.parse({ type });
          expect(result.type).toBe(type);
        }
      });

      it('should reject invalid notification type', () => {
        expect(() => notificationListQuerySchema.parse({ type: 'INVALID_TYPE' })).toThrow();
      });
    });

    describe('sorting', () => {
      it('should accept valid sortBy values', () => {
        const sortByValues = ['createdAt', 'type', 'read'];
        for (const sortBy of sortByValues) {
          const result = notificationListQuerySchema.parse({ sortBy });
          expect(result.sortBy).toBe(sortBy);
        }
      });

      it('should reject invalid sortBy value', () => {
        expect(() => notificationListQuerySchema.parse({ sortBy: 'invalid' })).toThrow();
      });

      it('should accept valid sortOrder values', () => {
        const result1 = notificationListQuerySchema.parse({ sortOrder: 'asc' });
        expect(result1.sortOrder).toBe('asc');
        
        const result2 = notificationListQuerySchema.parse({ sortOrder: 'desc' });
        expect(result2.sortOrder).toBe('desc');
      });

      it('should reject invalid sortOrder value', () => {
        expect(() => notificationListQuerySchema.parse({ sortOrder: 'invalid' })).toThrow();
      });
    });
  });

  describe('notificationUpdateSchema', () => {
    it('should accept read=true', () => {
      const result = notificationUpdateSchema.parse({ read: true });
      expect(result.read).toBe(true);
    });

    it('should accept read=false', () => {
      const result = notificationUpdateSchema.parse({ read: false });
      expect(result.read).toBe(false);
    });

    it('should reject missing read field', () => {
      expect(() => notificationUpdateSchema.parse({})).toThrow();
    });

    it('should reject non-boolean read value', () => {
      expect(() => notificationUpdateSchema.parse({ read: 'true' })).toThrow();
      expect(() => notificationUpdateSchema.parse({ read: 1 })).toThrow();
    });
  });

  describe('notificationBulkReadSchema', () => {
    it('should accept valid notification IDs array', () => {
      const result = notificationBulkReadSchema.parse({ notificationIds: [1, 2, 3] });
      expect(result.notificationIds).toEqual([1, 2, 3]);
    });

    it('should accept markAllAsRead=true', () => {
      const result = notificationBulkReadSchema.parse({ markAllAsRead: true });
      expect(result.markAllAsRead).toBe(true);
    });

    it('should accept both notificationIds and markAllAsRead', () => {
      const result = notificationBulkReadSchema.parse({ 
        notificationIds: [1, 2], 
        markAllAsRead: true 
      });
      expect(result.notificationIds).toEqual([1, 2]);
      expect(result.markAllAsRead).toBe(true);
    });

    it('should reject when neither notificationIds nor markAllAsRead is provided', () => {
      expect(() => notificationBulkReadSchema.parse({})).toThrow();
    });

    it('should reject markAllAsRead=false without notificationIds', () => {
      expect(() => notificationBulkReadSchema.parse({ markAllAsRead: false })).toThrow();
    });

    it('should reject empty notificationIds array', () => {
      expect(() => notificationBulkReadSchema.parse({ notificationIds: [] })).toThrow();
    });

    it('should reject invalid notification IDs', () => {
      expect(() => notificationBulkReadSchema.parse({ notificationIds: [0] })).toThrow();
      expect(() => notificationBulkReadSchema.parse({ notificationIds: [-1] })).toThrow();
      expect(() => notificationBulkReadSchema.parse({ notificationIds: [1.5] })).toThrow();
    });
  });

  describe('notificationBulkDeleteSchema', () => {
    it('should accept valid notification IDs array', () => {
      const result = notificationBulkDeleteSchema.parse({ notificationIds: [1, 2, 3] });
      expect(result.notificationIds).toEqual([1, 2, 3]);
    });

    it('should accept deleteAllRead=true', () => {
      const result = notificationBulkDeleteSchema.parse({ deleteAllRead: true });
      expect(result.deleteAllRead).toBe(true);
    });

    it('should accept both notificationIds and deleteAllRead', () => {
      const result = notificationBulkDeleteSchema.parse({ 
        notificationIds: [1, 2], 
        deleteAllRead: true 
      });
      expect(result.notificationIds).toEqual([1, 2]);
      expect(result.deleteAllRead).toBe(true);
    });

    it('should reject when neither notificationIds nor deleteAllRead is provided', () => {
      expect(() => notificationBulkDeleteSchema.parse({})).toThrow();
    });

    it('should reject deleteAllRead=false without notificationIds', () => {
      expect(() => notificationBulkDeleteSchema.parse({ deleteAllRead: false })).toThrow();
    });

    it('should reject empty notificationIds array', () => {
      expect(() => notificationBulkDeleteSchema.parse({ notificationIds: [] })).toThrow();
    });

    it('should reject invalid notification IDs', () => {
      expect(() => notificationBulkDeleteSchema.parse({ notificationIds: [0] })).toThrow();
      expect(() => notificationBulkDeleteSchema.parse({ notificationIds: [-1] })).toThrow();
    });
  });

  describe('notificationIdParamSchema', () => {
    it('should parse string ID to number', () => {
      const result = notificationIdParamSchema.parse({ id: '123' });
      expect(result.id).toBe(123);
    });

    it('should accept number ID', () => {
      const result = notificationIdParamSchema.parse({ id: 456 });
      expect(result.id).toBe(456);
    });

    it('should reject non-positive ID', () => {
      expect(() => notificationIdParamSchema.parse({ id: '0' })).toThrow();
      expect(() => notificationIdParamSchema.parse({ id: '-1' })).toThrow();
    });

    it('should reject non-integer ID', () => {
      expect(() => notificationIdParamSchema.parse({ id: '1.5' })).toThrow();
    });

    it('should reject non-numeric string', () => {
      expect(() => notificationIdParamSchema.parse({ id: 'abc' })).toThrow();
    });
  });
});
