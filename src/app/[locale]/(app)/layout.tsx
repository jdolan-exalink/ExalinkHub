"use client";

import Header from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DndContext } from '@dnd-kit/core';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { Camera } from '@/lib/types';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const [onCameraDoubleClickHandler, setOnCameraDoubleClickHandler] = useState<((camera: Camera) => void) | null>(null);

  const handleCameraDoubleClick = (camera: Camera) => {
    if (onCameraDoubleClickHandler) {
      onCameraDoubleClickHandler(camera);
    }
  };

  const registerDoubleClickHandler = (handler: (camera: Camera) => void) => {
    setOnCameraDoubleClickHandler(() => handler);
  };

  // Mostrar sidebar solo en la página de Vivo
  const locale_live_path = `/${locale}/live`;
  const show_sidebar = pathname === locale_live_path;
  
  return (
    <DndContext>
      <SidebarProvider>
        <div className="flex h-screen w-full flex-col bg-background text-foreground">
          <Header />
          <div className="flex flex-1 w-full overflow-hidden">
            {show_sidebar && <AppSidebar onCameraDoubleClick={handleCameraDoubleClick} />}
            <main className="flex-1 w-full overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </DndContext>
  );
}
