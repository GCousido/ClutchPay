// types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      email: string;
      name: string;
      surnames: string | null;
      phone: string | null;
      country: string | null;
      image: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    surnames?: string | null;
    phone?: string | null;
    country?: string | null;
    image?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    surnames?: string | null;
    phone?: string | null;
    country?: string | null;
  }
}