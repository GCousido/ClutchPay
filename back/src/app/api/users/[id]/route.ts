// app/api/users/[id]/route.ts
import { BadRequestError, handleError, requireAuth, requireSameUser, validateBody } from '@/libs/api-helpers';
import { deleteImage, extractPublicId, uploadImage } from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { logger } from '@/libs/logger';
import { userUpdateSchema } from '@/libs/validations';
import { NextResponse } from 'next/server';

/**
 * GET /api/users/:id
 * Retrieves user profile by ID (user can only access their own profile)
 * @param {Request} request - HTTP request
 * @param {object} params - Route parameters with user ID
 * @returns {Promise<NextResponse>} User profile object
 * @throws {401} If user is not authenticated
 * @throws {403} If user tries to access another user's profile
 * @throws {400} If user ID is invalid
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuth();

    const resolvedParams = await params;
    const userId = Number(resolvedParams.id)

    logger.debug('Users', 'GET /api/users/:id - Fetching user profile', { userId, requestedBy: sessionUser.id });

    if (Number.isNaN(userId)) {
      throw new BadRequestError('Invalid user id format');
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

/**
 * PUT /api/users/:id
 * Updates user profile (supports image upload to Cloudinary)
 * User can only update their own profile
 * @param {Request} request - HTTP request with update data
 * @param {object} params - Route parameters with user ID
 * @returns {Promise<NextResponse>} Updated user object
 * @throws {401} If user is not authenticated
 * @throws {403} If user tries to update another user's profile
 * @throws {400} If user ID is invalid or validation fails
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuth();

    const resolvedParams = await params;
    const userId = Number(resolvedParams.id);

    logger.debug('Users', 'PUT /api/users/:id - Updating user profile', { userId, requestedBy: sessionUser.id });

    if (Number.isNaN(userId)) {
      throw new BadRequestError('Invalid user id format');
    }

    requireSameUser(sessionUser.id, userId);

    const body = await request.json();
    const validated = validateBody(userUpdateSchema, body);

    // Handle image upload if imageBase64 is provided
    let imageUrl = validated.imageUrl;
    let oldImagePublicId: string | null = null;

    if (validated.imageBase64) {
      logger.debug('Users', 'Processing profile image upload', { userId });
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
          logger.warn('User', 'Failed to delete old profile image', { publicId: oldImagePublicId, error });
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

    logger.info('Users', 'User profile updated', { userId, fieldsUpdated: Object.keys(updateData) });
    
    return NextResponse.json(updated);
  } catch (error) {
    return handleError(error);
  }
}