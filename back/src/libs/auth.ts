// lib/auth.ts
import { db } from '@/libs/db';
import bcrypt from 'bcryptjs';
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
          placeholder: 'user@example.com',
        },
        password: { 
          label: 'Password',
          type: 'password',
          placeholder: '••••••••',
        },
      },
      async authorize(credentials) {
        // Validate credentials
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and Password required');
        }

        // Search user in the database by email
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

        // Verify user exists
        if (!user) {
          throw new Error('User not found');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        // Return User for session
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

  // Callbacks customizing JWT and Session
  callbacks: {
    // This execute when JWT is created/updated
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

    // This execute when session is checked/created
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

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update every 24 hours
  },

  // JWT configuration
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Secret for NextAuth
  secret: process.env.NEXTAUTH_SECRET,
};