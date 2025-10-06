"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldCheck, Video, History, ListVideo, Settings, Menu, BarChart3, Badge, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { use_auth } from '@/contexts/auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const translate_user_menu = useTranslations('user_menu');
  const { user, logout, has_module_access } = use_auth();

  const locale_prefix = `/${locale}`;
  const show_sidebar_toggle = pathname.startsWith(`${locale_prefix}/live`);

  // Filtrar navegación según permisos del usuario
  const accessible_navigation = navigation_item_definitions.filter(({ slug }) => {
    // Mapear slugs a módulos
    const module_map: Record<string, string> = {
      'live': 'live',
      'recordings': 'recordings',
      'events': 'events',
      'plates-lpr': 'events', // LPR requiere acceso a eventos
      'counting': 'statistics',
      'settings': 'settings'
    };
    
    const required_module = module_map[slug];
    return required_module ? has_module_access(required_module) : true;
  });

  /**
   * Obtiene el badge de rol del usuario
   */
  const get_role_badge = (role: string) => {
    const role_config = {
      admin: { label: 'Admin', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
      operator: { label: 'Usuario', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      viewer: { label: 'Viewer', className: 'bg-green-500/10 text-green-500 border-green-500/20' }
    };
    
    return role_config[role as keyof typeof role_config] || role_config.viewer;
  };

  const role_badge = user ? get_role_badge(user.role) : null;

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
        <nav className="flex items-center space-x-4 lg:space-x-6 h-full flex-1">
          {accessible_navigation.map(({ slug, label_key, icon: Icon }) => {
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

        {/* Menú de usuario */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden md:inline">{user.username}</span>
                {role_badge && (
                  <span className={cn(
                    "hidden lg:inline px-2 py-0.5 text-xs font-medium rounded-full border",
                    role_badge.className
                  )}>
                    {role_badge.label}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.username}</p>
                  {role_badge && (
                    <p className="text-xs text-muted-foreground">{role_badge.label}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Selector de tema */}
              <div className="px-2 py-1.5">
                <ThemeToggle />
              </div>
              
              {/* Selector de idioma */}
              <div className="px-2 py-1.5">
                <LanguageSwitcher />
              </div>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>{translate_user_menu('logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export default Header;
