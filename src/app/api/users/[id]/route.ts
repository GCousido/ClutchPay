// app/api/users/me/route.ts - Perfil del usuario actual
import { handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await requireAuth();
    
    const profile = await db.user.findUnique({
      where: { id: user.id },
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

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = validateBody(userUpdateSchema, body);
    
    const updated = await db.user.update({
      where: { id: user.id },
      data: validated,
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    return handleError(error);
  }
}
