'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'ホーム', icon: '🏠' },
  { href: '/food', label: '食事', icon: '🍽️' },
  { href: '/recipe', label: 'レシピ', icon: '🥗' },
  { href: '/calendar', label: '記録', icon: '📅' },
  { href: '/weight', label: '体重', icon: '⚖️' },
  { href: '/profile', label: '設定', icon: '👤' },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:static md:border-t-0 md:border-r md:h-screen md:w-56 md:flex md:flex-col">
      <div className="hidden md:block p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-blue-600">CalTrack</h1>
        <p className="text-xs text-gray-400 mt-1">AI カロリー管理</p>
      </div>
      <div className="flex md:flex-col">
        {LINKS.map((l) => {
          const active = path === l.href;
          return (
            <Link key={l.href} href={l.href}
              className={`flex-1 md:flex-none flex flex-col md:flex-row items-center md:gap-3 justify-center md:justify-start px-2 md:px-6 py-3 text-xs md:text-sm font-medium transition-colors
                ${active ? 'text-blue-600 bg-blue-50 md:border-r-2 md:border-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
              <span className="text-lg md:text-base">{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
