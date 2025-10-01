"use client";

import Header from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DndContext } from '@dnd-kit/core';
import { useState } from 'react';
import type { Camera } from '@/lib/types';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [onCameraDoubleClickHandler, setOnCameraDoubleClickHandler] = useState<((camera: Camera) => void) | null>(null);

  const handleCameraDoubleClick = (camera: Camera) => {
    if (onCameraDoubleClickHandler) {
      onCameraDoubleClickHandler(camera);
    }
  };

  const registerDoubleClickHandler = (handler: (camera: Camera) => void) => {
    setOnCameraDoubleClickHandler(() => handler);
  };
  
  return (
    <DndContext>
      <SidebarProvider>
        <div className="flex h-screen flex-col bg-background text-foreground">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <AppSidebar onCameraDoubleClick={handleCameraDoubleClick} />
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </DndContext>
  );
}
