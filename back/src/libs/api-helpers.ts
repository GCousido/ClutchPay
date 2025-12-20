// libs/api-helpers.ts
import { authOptions } from '@/libs/auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { ZodError, ZodType } from 'zod';

/**
 * Verifies that the user is authenticated
 * @throws {Error} 'Unauthorized' error if there is no active session
 * @returns {Promise<SessionUser>} Current session user
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  
  return session.user;
}

/**
 * Verifies that the session user matches the target user
 * @param {number} sessionUserId - Session user ID
 * @param {number} targetUserId - Target user ID
 * @throws {Error} 'Forbidden' error if IDs don't match (except in development/test environment)
 */
export function requireSameUser(sessionUserId: number, targetUserId: number) {
  const isDevelopment = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  
  if (sessionUserId !== targetUserId && !isDevelopment) {
    throw new Error('Forbidden');
  }
}

/**
 * Handles API route errors and returns appropriate HTTP responses
 * @param {unknown} error - Error to handle (ZodError, Error, or unknown)
 * @returns {NextResponse} JSON response with appropriate status code
 * - 400 for validation errors (ZodError)
 * - 401 for authentication errors
 * - 403 for authorization errors
 * - 500 for internal server errors
 */
export function handleError(error: unknown) {
  console.error(error);
  
  if (error instanceof ZodError) {
    return NextResponse.json(
      { errors: error.issues },
      { status: 400 }
    );
  }
  
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { message: 'Forbidden' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
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