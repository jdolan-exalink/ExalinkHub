/**
 * Utilidades para fetch con bypass completo de SSL y soporte para cookies
 */

/**
 * Crear opciones de fetch que ignoren errores SSL completamente
 */
export function createFetchOptions(headers: Record<string, string> = {}): RequestInit {
  const options: RequestInit = {
    headers: {
      'User-Agent': 'Exalink-Hub/1.0',
      ...headers
    },
    credentials: 'include' // ← Importante: siempre incluir cookies para autenticación
  };

  // En entorno servidor (Node.js), ignorar errores SSL completamente
  if (typeof process !== 'undefined' && process.env) {
    try {
      const https = require('https');
      (options as any).agent = new https.Agent({
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
        secureProtocol: 'TLSv1_2_method'
      });
      
      // Configurar variables de entorno para ignorar SSL
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
      
      // SSL validation disabled silently
    } catch (e) {
      console.warn('⚠️ No se pudo deshabilitar validación SSL:', e);
    }
  }

  return options;
}

/**
 * Fetch con manejo de errores SSL completamente deshabilitado y soporte para cookies
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Configurar opciones más agresivas para ignorar SSL
  const httpsAgent = typeof process !== 'undefined' && process.env ? (() => {
    try {
      const https = require('https');
      return new https.Agent({
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
        secureProtocol: 'TLSv1_2_method'
      });
    } catch {
      return undefined;
    }
  })() : undefined;

  const mergedOptions: RequestInit = {
    ...createFetchOptions(),
    ...options,
    credentials: 'include', // ← Asegurar que las cookies se incluyan siempre
    headers: {
      'User-Agent': 'Exalink-Hub/1.0',
      ...((createFetchOptions() as any).headers || {}),
      ...(options.headers || {})
    }
  };

  if (httpsAgent) {
    (mergedOptions as any).agent = httpsAgent;
  }

  try {
    console.log(`🌐 Fetching: ${url} (SSL validation disabled, cookies included)`);
    return await fetch(url, mergedOptions);
  } catch (error) {
    console.error(`❌ Fetch error para ${url}:`, error);
    throw error;
  }
}