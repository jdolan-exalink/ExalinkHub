"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldCheck, Video, History, ListVideo, Settings, Menu, BarChart3, Badge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import type { FC } from 'react';

type NavigationItem = {
  slug: string;
  label_key: string;
  icon: FC<{ className?: string }>;
};

const navigation_item_definitions: NavigationItem[] = [
  { slug: 'live', label_key: 'live', icon: Video },
  { slug: 'recordings', label_key: 'recordings', icon: History },
  { slug: 'events', label_key: 'events', icon: ListVideo },
  { slug: 'plates-lpr', label_key: 'plates_lpr', icon: Badge },
  { slug: 'counting', label_key: 'counting', icon: BarChart3 },
  { slug: 'settings', label_key: 'settings', icon: Settings },
];

const Header: FC = () => {
  const pathname = usePathname();
  const locale = useLocale();
  const { toggleSidebar } = useSidebar();
  const translate_navigation = useTranslations('navigation');

  const locale_prefix = `/${locale}`;
  const show_sidebar_toggle = pathname.startsWith(`${locale_prefix}/live`);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="flex h-16 items-center px-1 sm:px-2 lg:px-4 w-full">
        <div className="flex items-center gap-2 mr-6">
          {show_sidebar_toggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <Link href={`${locale_prefix}/live`} className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <span className="font-headline text-xl font-semibold tracking-tight">
              Exalink Hub
            </span>
          </Link>
        </div>
        <nav className="flex items-center space-x-4 lg:space-x-6 h-full">
          {navigation_item_definitions.map(({ slug, label_key, icon: Icon }) => {
            const target_path = `${locale_prefix}/${slug}`;
            const is_active = pathname.startsWith(target_path);

            return (
              <Link
                key={slug}
                href={target_path}
                className={cn(
                  'flex items-center gap-2 h-full border-b-2 px-2 text-sm font-medium transition-colors',
                  is_active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-primary hover:border-primary/50'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{translate_navigation(label_key)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default Header;
