// app/api/users/[id]/route.ts
import { handleError, requireAuth, requireSameUser, validateBody } from '@/libs/api-helpers';
import { deleteImage, extractPublicId, uploadImage } from '@/libs/cloudinary';
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

    // Handle image upload if imageBase64 is provided
    let imageUrl = validated.imageUrl;
    let oldImagePublicId: string | null = null;

    if (validated.imageBase64) {
      // Get current user to check for existing image
      const currentUser = await db.user.findUnique({
        where: { id: userId },
        select: { imageUrl: true },
      });

      // If user has existing image, extract public_id for later deletion
      if (currentUser?.imageUrl) {
        oldImagePublicId = extractPublicId(currentUser.imageUrl);
      }

      // Upload new image to Cloudinary
      const uploadResult = await uploadImage(validated.imageBase64);
      imageUrl = uploadResult.url;

      // Delete old image from Cloudinary if exists
      if (oldImagePublicId) {
        try {
          await deleteImage(oldImagePublicId);
        } catch (error) {
          console.warn('Failed to delete old image:', error);
          // Don't fail the request if old image deletion fails
        }
      }
    }

    // Remove imageBase64 from update data (not a DB field)
    const { imageBase64: _, ...updateData } = validated;

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        ...(imageUrl !== undefined && { imageUrl }),
      },
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    return handleError(error);
  }
}