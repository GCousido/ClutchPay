import { handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { formatNotificationResponse } from '@/libs/notifications';
import {
    notificationIdParamSchema,
    notificationUpdateSchema,
} from '@/libs/validations/notification';
import { NextResponse } from 'next/server';

/**
 * Route parameters interface
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notifications/:id
 * 
 * Retrieves a specific notification by ID for the authenticated user.
 * Returns the notification with the constructed message.
 * 
 * @param request - The incoming request
 * @param params - Route parameters containing notification ID
 * @returns The notification details with message
 */
export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { id: idParam } = await params;
    const { id } = notificationIdParamSchema.parse({ id: idParam });

    const notification = await db.notification.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            issuerUser: true,
            debtorUser: true,
          },
        },
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (notification.userId !== user.id) {
      return NextResponse.json(
        { message: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      notification: formatNotificationResponse(notification),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/notifications/:id
 * 
 * Updates a specific notification's read status for the authenticated user.
 * 
 * @param request - The incoming request with read status
 * @param params - Route parameters containing notification ID
 * @returns The updated notification
 * 
 * Body:
 * - read: Boolean indicating read status
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { id: idParam } = await params;
    const { id } = notificationIdParamSchema.parse({ id: idParam });

    // Check if notification exists and belongs to user
    const existingNotification = await db.notification.findUnique({
      where: { id },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    if (existingNotification.userId !== user.id) {
      return NextResponse.json(
        { message: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = validateBody(notificationUpdateSchema, body);

    const updatedNotification = await db.notification.update({
      where: { id },
      data: { read: data.read },
      include: {
        invoice: {
          include: {
            issuerUser: true,
            debtorUser: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Notification updated successfully',
      notification: formatNotificationResponse(updatedNotification),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/notifications/:id
 * 
 * Deletes a specific notification for the authenticated user.
 * 
 * @param request - The incoming request
 * @param params - Route parameters containing notification ID
 * @returns Success message
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { id: idParam } = await params;
    const { id } = notificationIdParamSchema.parse({ id: idParam });

    // Check if notification exists and belongs to user
    const existingNotification = await db.notification.findUnique({
      where: { id },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    if (existingNotification.userId !== user.id) {
      return NextResponse.json(
        { message: 'Forbidden' },
        { status: 403 }
      );
    }

    await db.notification.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    return handleError(error);
  }
}
