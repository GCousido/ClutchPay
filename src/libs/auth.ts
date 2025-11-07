// lib/auth.ts
import { db } from '@/libs/db';
import bcrypt from 'bcrypt';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { 
          label: 'Email', 
          type: 'email',
          placeholder: 'usuario@example.com',
        },
        password: { 
          label: 'Contraseña', 
          type: 'password',
          placeholder: '••••••••',
        },
      },
      async authorize(credentials) {
        // Validar que existan credenciales
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email y contraseña requeridos');
        }

        // Buscar usuario por email
        const user = await db.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            surnames: true,
            phone: true,
            country: true,
            imageUrl: true,
          },
        });

        // Verificar que el usuario existe
        if (!user) {
          throw new Error('Usuario no encontrado');
        }

        // Verificar contraseña
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Contraseña incorrecta');
        }

        // Retornar usuario para la sesión
        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          surnames: user.surnames,
          phone: user.phone,
          country: user.country,
          image: user.imageUrl,
        };
      },
    }),
  ],

  // Callbacks para personalizar sesión y JWT
  callbacks: {
    // Ejecuta cuando se crea o actualiza el JWT
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.surnames = (user as any).surnames;
        token.phone = (user as any).phone;
        token.country = (user as any).country;
      }
      return token;
    },

    // Ejecuta cuando se accede a la sesión
    async session({ session, token }) {
      if (session.user) {
        session.user.id = parseInt(token.id as string);
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as any).surnames = token.surnames;
        (session.user as any).phone = token.phone;
        (session.user as any).country = token.country;
      }
      return session;
    },
  },

  // Páginas personalizadas
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  // TODO: ver JWT y como funciona
  // Configuración de sesión
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: 24 * 60 * 60, // Actualizar cada 24 horas
  },

  // Configuración de JWT
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  secret: process.env.NEXTAUTH_SECRET,
};