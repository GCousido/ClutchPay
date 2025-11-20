import { afterAll, beforeAll } from 'vitest';
import { db } from '../src/libs/db';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

beforeAll(async () => {
  // Limpiar la base de datos antes de iniciar tests
  await cleanDatabase();
});

// Solo limpiar después de cada test file, no después de cada test
// Esto permite que múltiples tests en el mismo archivo compartan datos del beforeEach
afterAll(async () => {
  await cleanDatabase();
  // Desconectar Prisma
  await db.$disconnect();
});

async function cleanDatabase() {
  // Orden importante: primero dependencias, luego tablas padre
  await db.notification.deleteMany({});
  await db.payment.deleteMany({});
  await db.invoice.deleteMany({});
  await db.user.deleteMany({});
}
