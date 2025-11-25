import { db } from '@/libs/db';
import { describe, expect, it } from 'vitest';

describe('Database connection', () => {
  it('should connect to database successfully', async () => {
    const result = await db.$queryRaw`SELECT 1 as value`;
    expect(result).toBeDefined();
  });

  it('should have User model', () => {
    expect(db.user).toBeDefined();
    expect(typeof db.user.findUnique).toBe('function');
    expect(typeof db.user.create).toBe('function');
  });

  it('should have Invoice model', () => {
    expect(db.invoice).toBeDefined();
    expect(typeof db.invoice.findMany).toBe('function');
  });

  it('should have Payment model', () => {
    expect(db.payment).toBeDefined();
    expect(typeof db.payment.create).toBe('function');
  });

  it('should have Notification model', () => {
    expect(db.notification).toBeDefined();
    expect(typeof db.notification.findMany).toBe('function');
  });

  describe('User CRUD operations', () => {
    it('should create and find user', async () => {
      // Clean up
      await db.user.deleteMany({ where: { email: 'crud@test.com' } });

      const user = await db.user.create({
        data: {
          email: 'crud@test.com',
          password: 'hashedpassword',
          name: 'CRUD',
          surnames: 'Test',
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('crud@test.com');

      const found = await db.user.findUnique({
        where: { email: 'crud@test.com' },
      });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);

      // Clean up after test
      await db.user.delete({ where: { id: user.id } });
    });

    it('should update user', async () => {
      // Clean up
      await db.user.deleteMany({ where: { email: 'update@test.com' } });

      const user = await db.user.create({
        data: {
          email: 'update@test.com',
          password: 'hashedpassword',
          name: 'Update',
          surnames: 'Test',
        },
      });

      const updated = await db.user.update({
        where: { id: user.id },
        data: { name: 'Updated' },
      });

      expect(updated.name).toBe('Updated');

      // Clean up after test
      await db.user.delete({ where: { id: user.id } });
    });

    it('should delete user', async () => {
      // Clean up
      await db.user.deleteMany({ where: { email: 'delete@test.com' } });

      const user = await db.user.create({
        data: {
          email: 'delete@test.com',
          password: 'hashedpassword',
          name: 'Delete',
          surnames: 'Test',
        },
      });

      const deleted = await db.user.delete({ where: { id: user.id } });
      expect(deleted.id).toBe(user.id);

      const found = await db.user.findUnique({
        where: { id: user.id },
      });

      expect(found).toBeNull();
    });
  });
});
