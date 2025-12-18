// instrumentation.ts
/**
 * Next.js Instrumentation file
 * This file runs once when the server starts (both in dev and production)
 * Used to initialize background tasks like scheduled jobs
 */
export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./src/libs/scheduler');
    startScheduler();
  }
}
