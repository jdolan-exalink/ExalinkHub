/**
 * Hook personalizado para gestionar la configuración y estado de las funciones del sistema
 * Centraliza la lógica para cargar, actualizar y verificar el estado de las funciones habilitadas
 */

import { useState, useEffect, useCallback } from 'react';

interface PanelFunction {
  id: 'lpr' | 'counting_people' | 'counting_vehicles';
  name: string;
  title: string;
  enabled: boolean;
  icon: string;
  url: string;
}

interface PanelFunctionsState {
  functions: PanelFunction[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook para gestionar las funciones del sistema (LPR, Conteo Personas, Conteo Vehicular)
 * @returns {Object} Estado y funciones para gestionar las funciones del sistema
 */
export function usePanelFunctions(): PanelFunctionsState & {
  refetch: () => Promise<void>;
  isFunctionEnabled: (id: string) => boolean;
  getEnabledFunctions: () => PanelFunction[];
} {
  const [state, setState] = useState<PanelFunctionsState>({
    functions: [
      {
        id: 'lpr',
        name: 'LPR (Matrículas)',
        title: 'Reconocimiento de Matrículas',
        enabled: false,
        icon: '🚗',
        url: '/plates-lpr'
      },
      {
        id: 'counting_people',
        name: 'Conteo de Personas',
        title: 'Conteo de Personas',
        enabled: false,
        icon: '👥',
        url: '/counting'
      },
      {
        id: 'counting_vehicles',
        name: 'Conteo Vehicular',
        title: 'Conteo Vehicular',
        enabled: false,
        icon: '🚙',
        url: '/vehicle-counting'
      }
    ],
    loading: true,
    error: null
  });

  /**
   * Carga la configuración actual de las funciones desde la API
   */
  const loadFunctions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/panels/config');
      if (!response.ok) {
        throw new Error('Error al cargar la configuración de funciones');
      }

      const data = await response.json();
      if (data.success && data.panels) {
        setState(prev => ({
          ...prev,
          functions: prev.functions.map(func => ({
            ...func,
            enabled: data.panels[func.id]?.enabled || false,
            title: data.panels[func.id]?.title || func.title
          })),
          loading: false
        }));
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error loading panel functions:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }));
    }
  }, []);

  /**
   * Verifica si una función específica está habilitada
   * @param id - ID de la función a verificar
   * @returns boolean - true si la función está habilitada
   */
  const isFunctionEnabled = useCallback((id: string): boolean => {
    return state.functions.find(func => func.id === id)?.enabled || false;
  }, [state.functions]);

  /**
   * Obtiene la lista de funciones habilitadas
   * @returns Array de funciones habilitadas
   */
  const getEnabledFunctions = useCallback((): PanelFunction[] => {
    return state.functions.filter(func => func.enabled);
  }, [state.functions]);

  /**
   * Recarga la configuración de funciones
   */
  const refetch = useCallback(async () => {
    await loadFunctions();
  }, [loadFunctions]);

  // Cargar las funciones al montar el componente
  useEffect(() => {
    loadFunctions();
  }, [loadFunctions]);

  return {
    ...state,
    refetch,
    isFunctionEnabled,
    getEnabledFunctions
  };
}

export default usePanelFunctions;