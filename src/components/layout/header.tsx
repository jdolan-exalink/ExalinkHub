"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Video, History, ListVideo, Settings, Menu, CreditCard, BarChart3, Badge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import type { FC } from 'react';

const navLinks = [
  { href: '/live', label: 'Vivo', icon: Video },
  { href: '/recordings', label: 'Grabaciones', icon: History },
  { href: '/events', label: 'Eventos', icon: ListVideo },
  { href: '/plates-lpr', label: 'Matrículas', icon: Badge, description: 'Panel profesional de matrículas' },
  { href: '/counting', label: 'Conteo', icon: BarChart3 },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

const Header: FC = () => {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  // Mostrar botón del sidebar solo en la página de Vivo
  const showSidebarToggle = pathname === '/live';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="flex h-16 items-center px-1 sm:px-2 lg:px-4 w-full">
        <div className="flex items-center gap-2 mr-6">
          {showSidebarToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <Link href="/events" className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <span className="font-headline text-xl font-semibold tracking-tight">
              Exalink Hub
            </span>
          </Link>
        </div>
        <nav className="flex items-center space-x-4 lg:space-x-6 h-full">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 h-full border-b-2 px-2 text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-primary hover:border-primary/50'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
