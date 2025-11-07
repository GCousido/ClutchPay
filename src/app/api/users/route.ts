// app/api/users/route.ts - Listar contactos del usuario
import { handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    
    // El usuario puede ver sus contactos
    const userData = await db.user.findUnique({
      where: { id: user.id },
      include: {
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
        },
      },
    });
    
    return NextResponse.json(userData?.contacts || []);
  } catch (error) {
    return handleError(error);
  }
}
