/**
 * Script to automatically set up and run tests with a dedicated test database.
 * 
 * This script:
 * 1. Starts a PostgreSQL container for tests (if not running)
 * 2. Waits for the database to be ready
 * 3. Runs Prisma migrations
 * 4. Executes the tests
 * 5. Optionally stops the container after tests
 */

import { execSync } from 'child_process';

const TEST_CONTAINER_NAME = 'clutchpay-test-db';
const TEST_DB_PORT = '5433'; // Different port to avoid conflicts with dev DB
const TEST_DB_NAME = 'clutchpay_test';
const TEST_DB_USER = 'test_user';
const TEST_DB_PASSWORD = 'test_pass';
const TEST_DATABASE_URL = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@localhost:${TEST_DB_PORT}/${TEST_DB_NAME}?schema=public`;

function log(message: string) {
  console.log(`\x1b[36m[test-runner]\x1b[0m ${message}`);
}

function error(message: string) {
  console.error(`\x1b[31m[test-runner]\x1b[0m ${message}`);
}

function success(message: string) {
  console.log(`\x1b[32m[test-runner]\x1b[0m ${message}`);
}

function execCommand(command: string, options: { silent?: boolean; env?: NodeJS.ProcessEnv } = {}): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      env: { ...process.env, ...options.env },
    });
  } catch (err: any) {
    if (options.silent) {
      return err.stdout || '';
    }
    throw err;
  }
}

function isContainerRunning(): boolean {
  try {
    const result = execCommand(
      `docker ps --filter "name=${TEST_CONTAINER_NAME}" --format "{{.Names}}"`,
      { silent: true }
    );
    return result.trim() === TEST_CONTAINER_NAME;
  } catch {
    return false;
  }
}

function containerExists(): boolean {
  try {
    const result = execCommand(
      `docker ps -a --filter "name=${TEST_CONTAINER_NAME}" --format "{{.Names}}"`,
      { silent: true }
    );
    return result.trim() === TEST_CONTAINER_NAME;
  } catch {
    return false;
  }
}

function startContainer() {
  if (isContainerRunning()) {
    log('Test database container is already running');
    return;
  }

  if (containerExists()) {
    log('Starting existing test database container...');
    execCommand(`docker start ${TEST_CONTAINER_NAME}`, { silent: true });
  } else {
    log('Creating and starting test database container...');
    execCommand(
      `docker run -d ` +
      `--name ${TEST_CONTAINER_NAME} ` +
      `-e POSTGRES_USER=${TEST_DB_USER} ` +
      `-e POSTGRES_PASSWORD=${TEST_DB_PASSWORD} ` +
      `-e POSTGRES_DB=${TEST_DB_NAME} ` +
      `-p ${TEST_DB_PORT}:5432 ` +
      `postgres:15`,
      { silent: true }
    );
  }
}

async function waitForDatabase(maxRetries = 30, retryInterval = 1000): Promise<boolean> {
  log('Waiting for database to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      execCommand(
        `docker exec ${TEST_CONTAINER_NAME} pg_isready -U ${TEST_DB_USER} -d ${TEST_DB_NAME}`,
        { silent: true }
      );
      success('Database is ready!');
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  error('Database failed to start in time');
  return false;
}

function runMigrations() {
  log('Running Prisma migrations...');
  execCommand('npx prisma migrate deploy', {
    env: { DATABASE_URL: TEST_DATABASE_URL },
  });
  success('Migrations applied successfully');
}

function stopContainer() {
  if (isContainerRunning()) {
    log('Stopping test database container...');
    execCommand(`docker stop ${TEST_CONTAINER_NAME}`, { silent: true });
    success('Container stopped');
  }
}

function runTests(args: string[]): number {
  log('Running tests...');
  
  const testArgs = args.length > 0 ? args.join(' ') : '';
  const command = `npx cross-env NODE_ENV=test DATABASE_URL="${TEST_DATABASE_URL}" TEST_DATABASE_URL="${TEST_DATABASE_URL}" vitest ${testArgs}`;
  
  try {
    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: TEST_DATABASE_URL,
        TEST_DATABASE_URL: TEST_DATABASE_URL,
      },
    });
    return 0;
  } catch (err: any) {
    return err.status || 1;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    // Check if Docker is available
    try {
      execCommand('docker --version', { silent: true });
    } catch {
      error('Docker is not installed or not running. Please install Docker and try again.');
      process.exit(1);
    }

    // Start the test database container
    startContainer();
    
    // Wait for database to be ready
    const isReady = await waitForDatabase();
    if (!isReady) {
      process.exit(1);
    }
    
    // Run migrations
    runMigrations();
    
    // Run tests
    const exitCode = runTests(args);
    
    // Stop container after tests
    stopContainer();
    
    process.exit(exitCode);
  } catch (err) {
    error(`Error: ${err}`);
    // Make sure to stop container even on error
    stopContainer();
    process.exit(1);
  }
}

main();
