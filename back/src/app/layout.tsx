import React from 'react';

export const metadata = {
  title: 'ClutchPay API',
  description: 'ClutchPay Backend API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
