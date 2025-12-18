// libs/api-helpers.ts
import { authOptions } from '@/libs/auth';
import { logger } from '@/libs/logger';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { ZodError, ZodType } from 'zod';

/**
 * Custom error classes for API routes
 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class InternalServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InternalServerError';
  }
}

/**
 * Verifies that the user is authenticated
 * @throws {UnauthorizedError} if there is no active session
 * @returns {Promise<SessionUser>} Current session user
 */
export async function requireAuth() {
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  
  return session.user;
}

/**
 * Verifies that the session user matches the target user
 * @param {number} sessionUserId - Session user ID
 * @param {number} targetUserId - Target user ID
 * @throws {ForbiddenError} if IDs don't match (except in development/test environment)
 */
export function requireSameUser(sessionUserId: number, targetUserId: number) {
  const isDevelopment = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  
  if (sessionUserId !== targetUserId && !isDevelopment) {
    throw new ForbiddenError();
  }
}

/**
 * Handles API route errors and returns appropriate HTTP responses
 * @param {unknown} error - Error to handle (custom error classes, ZodError, or unknown)
 * @returns {NextResponse} JSON response with appropriate status code
 * - 400 for BadRequestError and validation errors (ZodError)
 * - 401 for UnauthorizedError
 * - 403 for ForbiddenError
 * - 404 for NotFoundError
 * - 500 for InternalServerError or unknown errors
 */
export function handleError(error: unknown) {
  logger.error('API', 'Request error', error);
  
  if (error instanceof ZodError) {
    const formatted: Record<string, string> = {};
    error.issues.forEach((issue) => {
      const field = issue.path.join('.') || 'body';
      formatted[field] = issue.message;
    });
    return NextResponse.json(
      { message: 'Validation failed', errors: formatted },
      { status: 400 }
    );
  }
  
  if (error instanceof BadRequestError) {
    return NextResponse.json(
      { message: error.message },
      { status: 400 }
    );
  }
  
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { message: error.message },
      { status: 401 }
    );
  }
  
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { message: error.message },
      { status: 403 }
    );
  }
  
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { message: error.message },
      { status: 404 }
    );
  }
  
  if (error instanceof InternalServerError) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }
  
  // Unknown error
  if (error instanceof Error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { message: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Validates request body with a Zod schema
 * @template T - Type of the validated object
 * @param {ZodType<T>} schema - Zod schema for validation
 * @param {unknown} body - Request body to validate
 * @returns {T} Validated and typed data
 * @throws {ZodError} If validation fails
 */
export function validateBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

/**
 * Extracts and validates pagination parameters from URL
 * @param {URLSearchParams} searchParams - URL search parameters
 * @returns {{ page: number, limit: number, skip: number }} Object with pagination data
 * - page: Page number (minimum 1, default 1)
 * - limit: Items per page (between 1-1000, default 10)
 * - skip: Items to skip for SQL query
 */
export function getPagination(searchParams: URLSearchParams) {
  const pageParam = parseInt(searchParams.get('page') || '1');
  const limitParam = parseInt(searchParams.get('limit') || '10');
  
  const page = isNaN(pageParam) ? 1 : Math.max(1, pageParam);
  const limit = isNaN(limitParam) ? 10 : Math.min(1000, Math.max(1, limitParam));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}