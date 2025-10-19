/**
 * Sistema de tokens temporales para compartir exports de Frigate públicamente
 * Los tokens se almacenan en memoria y expiran automáticamente
 */

import { randomBytes } from 'crypto';

/**
 * Interfaz para datos de token de export
 */
interface ExportTokenData {
  server_id: string | number;
  export_id: string;
  created_at: number;
  expires_at: number;
  download_count: number;
  max_downloads?: number;
}

// Almacenamiento en memoria de tokens activos
const active_tokens: Map<string, ExportTokenData> = new Map();

// Duración por defecto: 24 horas
const DEFAULT_TOKEN_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Generar un token único para compartir un export
 * @param server_id - ID del servidor Frigate
 * @param export_id - ID del export a compartir
 * @param duration_ms - Duración del token en milisegundos (por defecto 24h)
 * @param max_downloads - Número máximo de descargas permitidas (opcional)
 * @returns Token generado
 */
export function create_share_token(
  server_id: string | number,
  export_id: string,
  duration_ms: number = DEFAULT_TOKEN_DURATION_MS,
  max_downloads?: number
): string {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();

  active_tokens.set(token, {
    server_id,
    export_id,
    created_at: now,
    expires_at: now + duration_ms,
    download_count: 0,
    max_downloads,
  });

  console.log('Token creado:', {
    token: token.slice(0, 16) + '...',
    server_id,
    export_id,
    expires_in_hours: duration_ms / (60 * 60 * 1000),
  });

  return token;
}

/**
 * Validar y obtener datos de un token de export
 * @param token - Token a validar
 * @returns Datos del token si es válido, null si no existe o expiró
 */
export function validate_share_token(token: string): ExportTokenData | null {
  const token_data = active_tokens.get(token);

  if (!token_data) {
    console.warn('Token no encontrado:', token.slice(0, 16) + '...');
    return null;
  }

  const now = Date.now();

  // Verificar expiración
  if (now > token_data.expires_at) {
    console.warn('Token expirado:', token.slice(0, 16) + '...');
    active_tokens.delete(token);
    return null;
  }

  // Verificar límite de descargas
  if (token_data.max_downloads && token_data.download_count >= token_data.max_downloads) {
    console.warn('Token alcanzó límite de descargas:', token.slice(0, 16) + '...');
    active_tokens.delete(token);
    return null;
  }

  return token_data;
}

/**
 * Incrementar contador de descargas de un token
 * @param token - Token cuyo contador incrementar
 */
export function increment_token_download_count(token: string): void {
  const token_data = active_tokens.get(token);
  
  if (token_data) {
    token_data.download_count++;
    
    // Si alcanzó el límite, eliminar el token
    if (token_data.max_downloads && token_data.download_count >= token_data.max_downloads) {
      console.log('Token alcanzó límite de descargas, eliminando:', token.slice(0, 16) + '...');
      active_tokens.delete(token);
    }
  }
}

/**
 * Revocar un token específico
 * @param token - Token a revocar
 * @returns true si se revocó, false si no existía
 */
export function revoke_share_token(token: string): boolean {
  const existed = active_tokens.has(token);
  
  if (existed) {
    active_tokens.delete(token);
    console.log('Token revocado:', token.slice(0, 16) + '...');
  }
  
  return existed;
}

/**
 * Revocar todos los tokens asociados a un export específico
 * @param server_id - ID del servidor
 * @param export_id - ID del export
 * @returns Número de tokens revocados
 */
export function revoke_tokens_for_export(server_id: string | number, export_id: string): number {
  let revoked_count = 0;

  for (const [token, data] of active_tokens.entries()) {
    if (data.server_id === server_id && data.export_id === export_id) {
      active_tokens.delete(token);
      revoked_count++;
    }
  }

  if (revoked_count > 0) {
    console.log(`Revocados ${revoked_count} tokens para export ${export_id} del servidor ${server_id}`);
  }

  return revoked_count;
}

/**
 * Limpiar tokens expirados periódicamente
 */
export function cleanup_expired_tokens(): number {
  const now = Date.now();
  let cleaned_count = 0;

  for (const [token, data] of active_tokens.entries()) {
    if (now > data.expires_at) {
      active_tokens.delete(token);
      cleaned_count++;
    }
  }

  if (cleaned_count > 0) {
    console.log(`Limpiados ${cleaned_count} tokens expirados`);
  }

  return cleaned_count;
}

/**
 * Obtener estadísticas de tokens activos
 */
export function get_token_stats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;

  for (const [, data] of active_tokens.entries()) {
    if (now > data.expires_at) {
      expired++;
    } else {
      active++;
    }
  }

  return {
    total: active_tokens.size,
    active,
    expired,
  };
}

// Limpiar tokens expirados cada hora
setInterval(() => {
  cleanup_expired_tokens();
}, 60 * 60 * 1000);
