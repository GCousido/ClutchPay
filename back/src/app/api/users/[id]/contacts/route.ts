// app/api/users/[id]/contacts/route.ts
import { getPagination, handleError, requireAuth, requireSameUser } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { addContactSchema, formatZodError } from '@/libs/validations';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * GET /api/users/:id/contacts
 * Retrieves paginated list of user's contacts
 * User can only access their own contacts
 * @param {Request} request - HTTP request with pagination params
 * @returns {Promise<NextResponse>} Paginated list of contacts with metadata
 * @throws {401} If user is not authenticated
 * @throws {403} If user tries to access another user's contacts
 * @throws {400} If user ID is invalid
 */
export async function GET(request: Request) {
  try {
    const sessionUser = await requireAuth();
    
    // Parse pagination parameters
    const url = new URL(request.url);

    const m = url.pathname.match(/\/api\/users\/(\d+)\/contacts\/?$/);
    if (!m) {
      return NextResponse.json({ message: 'Invalid user id in path' }, { status: 400 });
    }

    const userId = Number(m[1]);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    requireSameUser(sessionUser.id, userId);

    const { page, limit, skip } = getPagination(url.searchParams);

    // Get total count of contacts
    const totalContacts = await db.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    const total = totalContacts?._count.contacts || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Get paginated contacts
    const userData = await db.user.findUnique({
      where: { id: userId },
      select: {
        contacts: {
          select: {
            id: true,
            name: true,
            surnames: true,
            email: true,
            phone: true,
            country: true,
            imageUrl: true,
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    return NextResponse.json({
      meta: {
        total,
        totalPages,
        page,
        limit,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
      data: userData?.contacts || [],
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/users/:id/contacts
 * Removes a contact from user's contact list
 * User can only delete from their own contacts
 * @param {Request} request - HTTP request with contactId in body
 * @returns {Promise<NextResponse>} Success message (200)
 * @throws {401} If user is not authenticated
 * @throws {403} If user tries to delete from another user's contacts
 * @throws {400} If user ID or contactId is invalid
 * @throws {404} If contact not found in user's list
 */
export async function DELETE(request: Request) {
  try {
    const sessionUser = await requireAuth();

    const url = new URL(request.url);
    const m = url.pathname.match(/\/api\/users\/(\d+)\/contacts\/?$/);
    if (!m) {
      return NextResponse.json({ message: 'Invalid user id in path' }, { status: 400 });
    }
    const userId = Number(m[1]);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    requireSameUser(sessionUser.id, userId);

    const body = await request.json();
    const contactId = Number(body.contactId);

    if (!contactId || Number.isNaN(contactId)) {
      return NextResponse.json({ message: 'contactId is required and must be a number' }, { status: 400 });
    }

    if (contactId === userId) {
      return NextResponse.json({ message: 'Cannot remove yourself as a contact' }, { status: 400 });
    }

    // Check if contact relationship exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        contacts: {
          where: { id: contactId },
          select: { id: true },
        },
      },
    });

    if (!user || user.contacts.length === 0) {
      return NextResponse.json({ message: 'Contact not found' }, { status: 404 });
    }

    // Disconnect the contact
    await db.user.update({
      where: { id: userId },
      data: {
        contacts: {
          disconnect: { id: contactId },
        },
      },
    });

    return NextResponse.json({ message: 'Contact removed successfully' }, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/users/:id/contacts
 * Adds a new contact to user's contact list
 * User can only add to their own contacts
 * @param {Request} request - HTTP request with contactId in body
 * @returns {Promise<NextResponse>} Updated user with new contact (201)
 * @throws {401} If user is not authenticated
 * @throws {403} If user tries to add to another user's contacts
 * @throws {400} If user ID is invalid, tries to add themselves, or contact already exists
 * @throws {404} If contact user not found
 */
export async function POST(request: Request) {
  try {
    const sessionUser = await requireAuth();

    const url = new URL(request.url);
    const m = url.pathname.match(/\/api\/users\/(\d+)\/contacts\/?$/);
    if (!m) {
      return NextResponse.json({ message: 'Invalid user id in path' }, { status: 400 });
    }
    const userId = Number(m[1]);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    requireSameUser(sessionUser.id, userId);

    const body = await request.json();
    const parsed = addContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Validation failed', errors: formatZodError(parsed.error),}, { status: 400 });
    }
    const { contactId } = parsed.data;

    if (contactId === userId) {
      return NextResponse.json({ message: 'Cannot add yourself as a contact' }, { status: 400 });
    }

    // ensure target user exists
    const target = await db.user.findUnique({ where: { id: contactId }, select: { id: true, email: true, name: true } });
    if (!target) {
      return NextResponse.json({ message: 'Contact user not found' }, { status: 404 });
    }

    // Check if contact already exists
    const existingRelation = await db.user.findFirst({
      where: {
        id: userId,
        contacts: {
          some: { id: contactId },
        },
      },
    });
    if (existingRelation) {
      return NextResponse.json({ message: 'Contact already exists' }, { status: 400 });
    }

    // Try to connect the contact (many-to-many)
    try {
      const updated = await db.user.update({
        where: { id: userId },
        data: {
          contacts: {
            connect: { id: contactId },
          },
        },
        select: {
          id: true,
          contacts: {
            where: { id: contactId },
            select: { id: true, email: true, name: true, surnames: true, phone: true, country: true, imageUrl: true },
          },
        },
      });

      // return the connected contact info
      const added = updated.contacts?.[0] ?? null;
      return NextResponse.json({ message: 'Contact added', data: added }, { status: 201 });
    } catch (error: any) {
      // handle unique constraint / already connected
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ message: 'Contact already exists' }, { status: 400 });
      }
      throw error;
    }
  
  } catch (error) {
    return handleError(error);
  }
}