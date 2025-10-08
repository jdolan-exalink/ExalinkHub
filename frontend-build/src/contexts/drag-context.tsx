"use client";

import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { Camera } from '@/lib/types';

interface DragContextType {
  registerDragEndHandler: (handler: (event: DragEndEvent) => void) => void;
  registerDoubleClickHandler: (handler: (camera: Camera) => void) => void;
  onDragEnd: ((event: DragEndEvent) => void) | null;
  onDoubleClick: ((camera: Camera) => void) | null;
}

const DragContext = createContext<DragContextType | null>(null);

export function DragProvider({ children }: { children: React.ReactNode }) {
  // Usar refs para almacenar handlers sin causar re-renders
  const onDragEndRef = useRef<((event: DragEndEvent) => void) | null>(null);
  const onDoubleClickRef = useRef<((camera: Camera) => void) | null>(null);

  const registerDragEndHandler = useCallback((handler: (event: DragEndEvent) => void) => {
    console.log('🔗 Context: Registering drag end handler');
    onDragEndRef.current = handler;
  }, []);

  const registerDoubleClickHandler = useCallback((handler: (camera: Camera) => void) => {
    console.log('🔗 Context: Registering double click handler');
    onDoubleClickRef.current = handler;
  }, []);

  // Crear handlers estables que usan los refs
  const stableDragEndHandler = useCallback((event: DragEndEvent) => {
    if (onDragEndRef.current) {
      onDragEndRef.current(event);
    }
  }, []);

  const stableDoubleClickHandler = useCallback((camera: Camera) => {
    if (onDoubleClickRef.current) {
      onDoubleClickRef.current(camera);
    }
  }, []);

  // El contextValue ahora nunca cambia porque los handlers son estables
  const contextValue = useMemo(() => ({
    registerDragEndHandler,
    registerDoubleClickHandler,
    onDragEnd: stableDragEndHandler,
    onDoubleClick: stableDoubleClickHandler,
  }), [registerDragEndHandler, registerDoubleClickHandler, stableDragEndHandler, stableDoubleClickHandler]);

  return (
    <DragContext.Provider value={contextValue}>
      {children}
    </DragContext.Provider>
  );
}

export function useDragContext() {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error('useDragContext must be used within a DragProvider');
  }
  return context;
}