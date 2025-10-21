/**
 * Funciones helper para configuración del backend LPR
 */

/**
 * Obtiene la URL base del backend LPR
 * En Docker: usa el nombre del servicio (lpr-backend:2221)
 * En desarrollo: usa localhost:2221 o variable de entorno
 */
export async function getLPRBackendURL(): Promise<string> {
  // Forzar uso del nombre del servicio en Docker para evitar problemas de resolución
  // El servicio matriculas-listener está en la misma red que el frontend
  if (process.env.NODE_ENV === 'production' || process.env.DOCKER_CONTAINER === 'true') {
    return 'http://matriculas-listener:2221';
  }

  // En desarrollo, usar localhost
  return process.env.LPR_BACKEND_URL || 'http://localhost:2221';
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