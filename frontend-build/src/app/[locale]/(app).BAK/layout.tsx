"use client";

import React from 'react';
import Header from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { Camera } from '@/lib/types';
import { DragProvider, useDragContext } from '@/contexts/drag-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  console.log('=== LAYOUT COMPONENT RENDERING ===');
  console.log('Window location:', typeof window !== 'undefined' ? window.location.href : 'Server side');
  
  return (
    <DragProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </DragProvider>
  );
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  // Configurar sensores para @dnd-kit
  const mouseSensor = useSensor(MouseSensor, {
    // Requiere que el mouse se mueva al menos 3px antes de activar drag
    activationConstraint: {
      distance: 3,
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    // Requiere que el toque se mantenga por al menos 250ms antes de activar drag
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });
  
  const sensors = useSensors(mouseSensor, touchSensor);
  
  const pathname = usePathname();
  const locale = useLocale();
  const dragContext = useDragContext();
  const [onCameraDoubleClickHandler, setOnCameraDoubleClickHandler] = useState<((camera: Camera) => void) | null>(null);

  const handleCameraDoubleClick = (camera: Camera) => {
    if (onCameraDoubleClickHandler) {
      onCameraDoubleClickHandler(camera);
    }
  };

  const registerDoubleClickHandler = (handler: (camera: Camera) => void) => {
    setOnCameraDoubleClickHandler(() => handler);
  };

  const handleDragStart = (event: any) => {
    console.log('🚀 REAL DRAG STARTED:', event);
    console.log('Drag ID:', event.active.id);
    console.log('Drag data:', event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    console.log('🎯 REAL DRAG ENDED:', event);
    console.log('Layout: handleDragEnd called with event:', event);
    if (dragContext.onDragEnd) {
      console.log('Layout: Calling registered drag end handler via context');
      dragContext.onDragEnd(event);
    } else {
      console.log('Layout: No drag end handler registered in context');
    }
  };

  const handleDragOver = (event: any) => {
    console.log('📍 REAL DRAG OVER:', event.over?.id);
  };

  // Mostrar sidebar solo en la página de Vivo
  const locale_live_path = `/${locale}/live`;
  const show_sidebar = pathname === locale_live_path;
  
  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
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
