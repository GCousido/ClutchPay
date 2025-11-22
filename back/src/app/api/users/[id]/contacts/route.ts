// app/api/users/[id]/contacts/route.ts
import { getPagination, handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { addContactSchema, formatZodError } from '@/libs/validations';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

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

    // TODO: eliminar DEV_ALLOW_BYPASS al entregar
    if (sessionUser.id !== userId && !(process.env.DEV_ALLOW_BYPASS === 'true')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

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

    // TODO: eliminar DEV_ALLOW_BYPASS al entregar
    if (sessionUser.id !== userId && !(process.env.DEV_ALLOW_BYPASS === 'true')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

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