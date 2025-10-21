/**
 * Funciones helper para configuración del backend LPR
 */

/**
 * Obtiene la URL base del backend LPR
 * En Docker: usa el nombre del servicio (lpr-backend:2221)
 * En desarrollo: usa localhost:2221 o variable de entorno
 */
export async function getLPRBackendURL(): Promise<string> {
  // Primero intentar obtener de configuración de base de datos
  try {
    const configDb = (await import('@/lib/config-database')).default;
    const db = new configDb();
    const lprConfig = db.getBackendConfigByService('LPR (Matrículas)');

    if (lprConfig && lprConfig.config) {
      const config = JSON.parse(lprConfig.config);
      if (config.api_url) {
        return config.api_url;
      }
      if (config.api_host && config.api_port) {
        return `http://${config.api_host}:${config.api_port}`;
      }
    }
  } catch (error) {
    console.warn('⚠️ Error obteniendo configuración LPR de DB:', error);
  }

  // Fallback: usar variable de entorno o valores por defecto
  const envUrl = process.env.LPR_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }

  // En Docker, usar nombre del servicio
  // En desarrollo local, usar localhost
  const isDocker = process.env.DOCKER_CONTAINER === 'true' || process.env.NODE_ENV === 'production';
  return isDocker ? 'http://lpr-backend:2221' : 'http://localhost:2221';
}

/**
 * Obtiene la URL completa para archivos multimedia del backend LPR
 * @param relativePath - Ruta relativa del archivo (ej: "snapshots/camera/123.jpg")
 */
export async function getLPRMediaURL(relativePath: string): Promise<string> {
  const baseUrl = await getLPRBackendURL();
  return `${baseUrl}/media/${relativePath}`;
}

/**
 * Obtiene la URL del proxy interno para archivos multimedia
 * Esta URL es accesible desde el frontend
 * @param relativePath - Ruta relativa del archivo
 */
export function getLPRMediaProxyURL(relativePath: string): string {
  return `/api/lpr/files/media/${relativePath}`;
}