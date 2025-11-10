import { db } from "@/libs/db";
import { formatZodError } from "@/libs/validations";
import { userCreateSchema } from '@/libs/validations/user';
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log(body)

    // Validate with Zod
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: formatZodError(parsed.error),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: data.email},
    });

    if (existing) {
      return NextResponse.json(
        {
          message: "Email already exists",
          errors: [{ field: "email", message: "Email already in use" }],
        },
        { status: 400 }
      );
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(data.password, 10);

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
        return NextResponse.json(
          {
            message: "Email already exists",
            errors: [{ field: "email", message: "Email already in use" }],
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Hide password in response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...user } = newUser;

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        details: error?.message,
      },
      { status: 500 }
    );
  }
}