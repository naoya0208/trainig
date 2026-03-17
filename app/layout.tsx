import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CalTrack - AI カロリー管理',
  description: 'AIで食事・運動・体重を管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${geist.className} bg-gray-50 text-gray-900`}>
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 pb-20 md:pb-0 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
