// app/api/users/route.ts
import { getPagination, handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/users
 * Retrieves a paginated list of all users (requires authentication)
 * @param {Request} request - HTTP request with pagination params
 * @returns {Promise<NextResponse>} Paginated list of users with metadata
 * @throws {401} If user is not authenticated
 */
export async function GET(request: Request) {
  try {
    // Check authentication
    await requireAuth();

    // Parse pagination parameters
    const url = new URL(request.url);
    const { page, limit, skip } = getPagination(url.searchParams);

    // Fetch total count of users
    const total = await db.user.count();

    // Fetch paginated users
    const users = await db.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        surnames: true,
        phone: true,
        country: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate total pages
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Return paginated response
    return NextResponse.json({
      meta: {
        total,
        totalPages,
        page,
        limit,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
      data: users,
    });
  } catch (error) {
    return handleError(error);
  }
}
