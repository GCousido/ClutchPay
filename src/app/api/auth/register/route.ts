import { db } from "@/libs/db";
import { formatZodError } from "@/libs/validations";
import { userCreateSchema } from '@/libs/validations/user';
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validación con Zod
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

    // Comprobar si el email ya existe (buscar por email solamente)
    const existing = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return NextResponse.json(
        {
          message: "Email already exists",
          errors: [{ field: "email", message: "El correo ya está en uso" }],
        },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = bcrypt.hashSync(data.password, 10);

    // Crear usuario
    const newUser = await db.user.create({
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

    // Ocultar password en la respuesta
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