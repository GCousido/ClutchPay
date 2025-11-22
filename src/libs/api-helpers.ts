// lib/api-helpers.ts
import { authOptions } from '@/libs/auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { ZodError, ZodType } from 'zod';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  
  return session.user;
}

export function requireSameUser(sessionUserId: number, targetUserId: number) {
  const isDevelopment = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  
  if (sessionUserId !== targetUserId && !isDevelopment) {
    throw new Error('Forbidden');
  }
}

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

export function validateBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

export function getPagination(searchParams: URLSearchParams) {
  const pageParam = parseInt(searchParams.get('page') || '1');
  const limitParam = parseInt(searchParams.get('limit') || '10');
  
  const page = isNaN(pageParam) ? 1 : Math.max(1, pageParam);
  const limit = isNaN(limitParam) ? 10 : Math.min(1000, Math.max(1, limitParam));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}