// app/api/users/route.ts
import { handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    
    // User contacts
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