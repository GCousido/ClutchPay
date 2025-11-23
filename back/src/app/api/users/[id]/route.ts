// app/api/users/[id]/route.ts
import { handleError, requireAuth, requireSameUser, validateBody } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { userUpdateSchema } from '@/libs/validations';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuth();

    const resolvedParams = await params;
    const userId = Number(resolvedParams.id)

    if (Number.isNaN(userId)) {
      return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    requireSameUser(sessionUser.id, userId);
    
    const profile = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        surnames: true,
        phone: true,
        country: true,
        imageUrl: true,
        createdAt: true,
      },
    });
    
    return NextResponse.json(profile);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuth();

    const resolvedParams = await params;
    const userId = Number(resolvedParams.id);

    if (Number.isNaN(userId)) {
      return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    requireSameUser(sessionUser.id, userId);

    const body = await request.json();
    const validated = validateBody(userUpdateSchema, body);

    const updated = await db.user.update({
      where: { id: userId },
      data: validated,
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    return handleError(error);
  }
}