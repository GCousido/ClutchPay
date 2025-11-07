// app/api/users/[id]/route.ts - Ver perfil de un contacto
import { handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    // Verificar que es un contacto del usuario
    const contact = await db.user.findFirst({
      where: {
        id: parseInt(id),
        contactOf: {
          some: { id: user.id },
        },
      },
      select: {
        id: true,
        name: true,
        surnames: true,
        email: true,
        phone: true,
        country: true,
        imageUrl: true,
      },
    });
    
    if (!contact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    return NextResponse.json(contact);
  } catch (error) {
    return handleError(error);
  }
}
