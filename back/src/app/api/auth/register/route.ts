// app/api/auth/register/route.ts
import { BadRequestError, handleError } from "@/libs/api-helpers";
import { db } from "@/libs/db";
import { logger } from "@/libs/logger";
import { userCreateSchema } from '@/libs/validations/user';
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

/**
 * POST /api/auth/register
 * Registers a new user with email and password
 * Hashes password with bcrypt before storing
 * @param {Request} request - HTTP request with user registration data
 * @returns {Promise<NextResponse>} Created user object (201)
 * @throws {400} If validation fails or email already exists
 */
export async function POST(request: Request) {
  try {
    logger.debug('Auth', 'POST /api/auth/register - Registration attempt');
    const body = await request.json();

    // Validate with Zod
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw parsed.error;
    }

    const data = parsed.data;

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      logger.debug('Auth', 'Registration failed - email already in use', { email: data.email });
      throw new BadRequestError('Cannot create user - email already in use');
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    logger.debug('Auth', 'Password hashed, creating user');

    // Create user - catch unique constraint error (P2002) to handle race conditions
    let newUser;
    try {
      newUser = await db.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
          surnames: data.surnames,
          phone: data.phone ?? null,
          country: data.country ?? null,
          imageUrl: data.imageUrl ?? null,
        },
      });
    } catch (error: any) {
      // Handle Prisma unique constraint error (P2002)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target as string[] || []).includes("email")
      ) {
        throw new BadRequestError('Cannot create user - email already in use');
      }
      throw error;
    }

    // Hide password in response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...user } = newUser;

    logger.info('Auth', 'User registered successfully', { userId: user.id, email: user.email });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}