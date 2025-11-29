import { afterAll, beforeAll, vi } from 'vitest';
import { db } from '../src/libs/db';

// Set test environment
// @ts-expect-error - Restoring original NODE_ENV
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Mock NextAuth getServerSession with global context
let mockSession: any = null;

export function setMockSession(session: any) {
  mockSession = session;
}

export function clearMockSession() {
  mockSession = null;
}

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() => {
    return Promise.resolve(mockSession);
  }),
}));

beforeAll(async () => {
  // Clear database before starting tests
  await cleanDatabase();
});

// Clear database after each test file
afterAll(async () => {
  await cleanDatabase();
  await db.$disconnect();
});

// Helper function to clean database in order of dependencies
async function cleanDatabase() {
  await db.notification.deleteMany({});
  await db.payment.deleteMany({});
  await db.invoice.deleteMany({});
  await db.user.deleteMany({});
}
