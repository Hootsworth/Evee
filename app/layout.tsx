'use client';

import { usePathname } from 'next/navigation';
import './globals.css';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/auth';

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white text-black antialiased selection:bg-[#ef2cc1]/20">
        {!isAuthPage && <NavBar />}
        <main className="flex-1 flex flex-col">{children}</main>
        {!isAuthPage && <Footer />}
      </body>
    </html>
  );
}
