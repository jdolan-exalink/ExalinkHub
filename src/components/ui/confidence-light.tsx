'use client';

import { cn } from '@/lib/utils';
import type { ConfidenceLevel } from '@/lib/types';

interface ConfidenceLightProps {
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

export function ConfidenceLight({ 
  confidence, 
  size = 'md', 
  showValue = true,
  className 
}: ConfidenceLightProps) {
  
  // Determinar nivel de confianza según los umbrales
  const getConfidenceLevel = (conf: number): ConfidenceLevel => {
    if (conf >= 0.85) {
      return { level: 'high', color: 'green', threshold: 0.85 };
    } else if (conf >= 0.70) {
      return { level: 'medium', color: 'yellow', threshold: 0.70 };
    } else {
      return { level: 'low', color: 'red', threshold: 0.70 };
    }
  };

  const level = getConfidenceLevel(confidence);
  const percentage = Math.round(confidence * 100);

  // Tamaños de los LEDs
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const ledSize = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Conjunto de 3 LEDs */}
      <div className="flex items-center gap-1">
        {/* LED Verde */}
        <div
          className={cn(
            ledSize,
            'rounded-full border-2',
            level.color === 'green'
              ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/50'
              : 'bg-gray-200 border-gray-300'
          )}
          title="Alta confianza (85%+)"
        />
        
        {/* LED Amarillo */}
        <div
          className={cn(
            ledSize,
            'rounded-full border-2',
            level.color === 'yellow'
              ? 'bg-yellow-500 border-yellow-600 shadow-lg shadow-yellow-500/50'
              : 'bg-gray-200 border-gray-300'
          )}
          title="Confianza media (70-84%)"
        />
        
        {/* LED Rojo */}
        <div
          className={cn(
            ledSize,
            'rounded-full border-2',
            level.color === 'red'
              ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/50'
              : 'bg-gray-200 border-gray-300'
          )}
          title="Baja confianza (<70%)"
        />
      </div>

      {/* Valor de confianza */}
      {showValue && (
        <span className={cn(
          'text-sm font-medium',
          level.color === 'green' && 'text-green-700',
          level.color === 'yellow' && 'text-yellow-700',
          level.color === 'red' && 'text-red-700'
        )}>
          {percentage}%
        </span>
      )}
    </div>
  );
}

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const getConfidenceLevel = (conf: number): ConfidenceLevel => {
    if (conf >= 0.85) {
      return { level: 'high', color: 'green', threshold: 0.85 };
    } else if (conf >= 0.70) {
      return { level: 'medium', color: 'yellow', threshold: 0.70 };
    } else {
      return { level: 'low', color: 'red', threshold: 0.70 };
    }
  };

  const level = getConfidenceLevel(confidence);
  const percentage = Math.round(confidence * 100);

  const badgeClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    red: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
      badgeClasses[level.color],
      className
    )}>
      <div className={cn(
        'w-2 h-2 rounded-full mr-1',
        level.color === 'green' && 'bg-green-500',
        level.color === 'yellow' && 'bg-yellow-500',
        level.color === 'red' && 'bg-red-500'
      )} />
      {percentage}%
    </span>
  );
}

// Componente de leyenda para explicar el sistema de semáforo
export function ConfidenceLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-600">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span>Alta (85%+)</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-yellow-500 rounded-full" />
        <span>Media (70-84%)</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span>Baja (&lt;70%)</span>
      </div>
    </div>
  );
}