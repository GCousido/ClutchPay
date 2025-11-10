import { authOptions } from "@/libs/auth";
import { getServerSession } from "next-auth/next";
import { NextIntlClientProvider } from 'next-intl';
import Link from 'next/link';
import LanguageSelector from '../components/LanguageSelector';
import LogoIcon from '../components/LogoIcon';
import getRequestConfig from '../i18n/request';

import './globals.css';

type RootLayoutProps = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const { locale, messages } = await getRequestConfig();
  const session = await getServerSession(authOptions);

  return (
    <html lang={locale}>
      {/* min-h-screen fuerza que el body cubra toda la pantalla */}
      <body className="flex flex-col min-h-screen bg-green-50">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* flex-1 permite que este div crezca y ocupe todo el espacio disponible */}
          <header className="w-full bg-white shadow py-4 border-b border-green-100">
            <nav className="flex justify-between items-center px-8">
              <LogoIcon />
              <div className="flex items-center gap-3 ml-auto">
                {!session?.user ? (
                  <>
                    <Link
                      href="/login"
                      className="px-5 py-2 border border-green-600 text-green-600 font-semibold rounded-md hover:bg-green-50 transition"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="px-5 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition"
                    >
                      Register
                    </Link>
                  </>
                ) : (
                  <img
                    src={session?.user.image || "/default-profile.png"}
                    alt="Profile"
                    className="w-10 h-10 rounded-full border-2 border-green-200 object-cover"
                  />
                )}
              </div>
            </nav>
          </header>

          <main className="flex-1 flex flex-col justify-center items-center">
            {children}
          </main>
          {/* el footer siempre estará abajo */}
          <footer className="w-full flex justify-center bg-white shadow py-6 border-t border-green-100">
            <LanguageSelector locale={locale} />
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

