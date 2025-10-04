/**
 * Utilidades para autenticación JWT con Frigate usando cookies
 * Basado en el ejemplo de Python exitoso
 */

import { secureFetch } from './secure-fetch';

interface JWTLoginResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface AuthResult {
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
}

interface ValidationResult {
  success: boolean;
  message: string;
  requiresAuth: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
  metrics?: any;
}

/**
 * Realizar login JWT con Frigate usando autenticación por cookies
 * Basado en el ejemplo de Python exitoso
 */
export async function loginToFrigate(
  baseUrl: string, 
  username: string, 
  password: string
): Promise<AuthResult> {
  try {
    const loginUrl = `${baseUrl}/api/login`;
    
    // Preparar datos de login como JSON (user, password) según el ejemplo Python
    const payload = {
      user: username,      // ← Cambio: "user" en lugar de "username"
      password: password
    };
    
    // console.log(`🔐 Intentando login JWT en: ${loginUrl}`);
    // console.log(`📝 Datos: user=${username}, Content-Type=application/json`);
    
    // Configurar opciones de fetch que ignoren SSL completamente
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',  // ← Cambio: JSON en lugar de form-urlencoded
        'User-Agent': 'Exalink-Hub/1.0'
      },
      body: JSON.stringify(payload),         // ← Cambio: JSON payload
      credentials: 'include'                 // ← Importante: incluir cookies
    };

    // En entorno Node.js (servidor), ignorar errores SSL
    if (typeof process !== 'undefined' && process.env) {
      try {
        const https = require('https');
        (fetchOptions as any).agent = new https.Agent({
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined
        });
      } catch (e) {
        console.warn('No se pudo configurar agente HTTPS:', e);
      }
    }
    
    const response = await fetch(loginUrl, fetchOptions);

    // console.log(`📡 Respuesta login: ${response.status} ${response.statusText}`);
    // console.log(`🍪 Set-Cookie: ${response.headers.get('Set-Cookie') || 'No cookies'}`);
    
    // Verificar si hay cookies de autenticación (como en el ejemplo Python)
    const setCookieHeader = response.headers.get('Set-Cookie');
    const hasAuthCookie = setCookieHeader && (
      setCookieHeader.includes('frigate_token') ||
      setCookieHeader.includes('session') ||
      setCookieHeader.includes('access_token') ||
      setCookieHeader.includes('jwt') ||
      setCookieHeader.includes('auth') ||
      setCookieHeader.includes('sessionid')
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error login JWT: ${response.status} - ${errorText}`);
      
      let detailedError = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          detailedError += `\nDetalle: ${JSON.stringify(errorJson.detail, null, 2)}`;
        }
      } catch {
        detailedError += `\nRespuesta: ${errorText}`;
      }
      
      if (response.status === 401) {
        return { success: false, error: 'Credenciales inválidas - Usuario o contraseña incorrectos' };
      } else if (response.status === 404) {
        return { success: false, error: 'Endpoint /api/login no encontrado - Verificar versión de Frigate' };
      } else if (response.status === 422) {
        return { success: false, error: `Datos de login inválidos - ${detailedError}` };
      }
      return { success: false, error: detailedError };
    }

    // ✅ Login exitoso (HTTP 200)
    if (hasAuthCookie) {
      // console.log('✅ Cookie de autenticación detectada en respuesta exitosa');
      
      // Extraer el token de la cookie si está disponible
      let tokenFromCookie = null;
      if (setCookieHeader.includes('frigate_token=')) {
        const tokenMatch = setCookieHeader.match(/frigate_token=([^;]+)/);
        if (tokenMatch) {
          tokenFromCookie = tokenMatch[1];
          // console.log(`🔑 Token extraído de cookie: ${tokenFromCookie.substring(0, 20)}...`);
        }
      }

      // También intentar leer el body por si tiene JSON (como backup)
      try {
        const responseText = await response.text();
        if (responseText && responseText.trim()) {
          const data = JSON.parse(responseText);
          if (data.access_token) {
        // console.log('📄 Token JWT también encontrado en response body');
            return {
              success: true,
              token: data.access_token,
              expiresAt: new Date(Date.now() + 86400000).toISOString() // 24 horas
            };
          }
        }
      } catch {
        // No hay problema si no hay JSON en el body (caso típico con Content-Length: 0)
        console.log('💭 No hay JSON en body, usando autenticación por cookie únicamente');
      }

      // Autenticación exitosa por cookie (el caso normal según el curl)
      return {
        success: true,
        token: tokenFromCookie || 'cookie-based-auth', // Usar token real o indicador
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      };
    }

    // Si llegamos aquí, HTTP 200 pero sin cookies de auth - intentar parsear JSON tradicional
    try {
      const data: JWTLoginResponse = await response.json();
      console.log('📄 Datos de respuesta JWT tradicional:', { 
        hasToken: !!data.access_token, 
        tokenType: data.token_type,
        expiresIn: data.expires_in 
      });
      
      if (data.access_token) {
        const expiresInSeconds = data.expires_in || 86400;
        const expiresAt = new Date(Date.now() + (expiresInSeconds * 1000)).toISOString();

        return {
          success: true,
          token: data.access_token,
          expiresAt
        };
      }
    } catch (e) {
      console.log('⚠️ No hay JSON response válido');
    }

    return { success: false, error: 'Login exitoso pero no se detectó método de autenticación válido' };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión'
    };
  }
}

/**
 * Validar conexión con servidor Frigate (autenticación inteligente)
 * Intenta primero sin auth, luego automáticamente con JWT/cookies si es necesario
 */
export async function validateServerConnection(
  baseUrl: string,
  authData?: { username?: string; password?: string }
): Promise<ValidationResult> {
  try {
    // console.log(`🔍 Validando conexión automática: ${baseUrl}`);

    // 1. Verificar conexión básica a /api/config (sin autenticación)
    const configUrl = `${baseUrl}/api/config`;
    // console.log('🌐 Probando acceso sin autenticación...');
    const basicResponse = await secureFetch(configUrl);
    
    if (basicResponse.ok) {
      console.log('✅ Acceso exitoso sin autenticación requerida');
      return {
        success: true,
        message: 'Conexión exitosa - Servidor público (sin autenticación)',
        requiresAuth: false
      };
    }

    // console.log(`📡 Respuesta sin auth: ${basicResponse.status} - Se requiere autenticación`);

    // 2. Si no tenemos credenciales, informar que se requiere auth
    if (!authData?.username || !authData?.password) {
      return {
        success: false,
        message: 'Servidor requiere autenticación - Proporciona usuario y contraseña',
        requiresAuth: true
      };
    }

    // 3. Intentar autenticación JWT automática con cookies
    // console.log('🔐 Probando autenticación JWT con cookies...');
    const authResult = await loginToFrigate(baseUrl, authData.username, authData.password);
    
    if (!authResult.success) {
      return {
        success: false,
        message: `Error de autenticación: ${authResult.error}`,
        requiresAuth: true,
        error: authResult.error
      };
    }

    // console.log('✅ Login exitoso, validando acceso autenticado...');

    // 4. Validar que podemos acceder con la autenticación obtenida
    let authHeaders: Record<string, string> = {};
    
    // Si tenemos token JWT tradicional, usarlo en Authorization header
    if (authResult.token && !authResult.token.startsWith('cookie-based')) {
      // El token puede ser el JWT real extraído de la cookie
      authHeaders['Authorization'] = `Bearer ${authResult.token}`;
      // console.log(`🔑 Usando token JWT en Authorization header: ${authResult.token.substring(0, 20)}...`);
    }
    
    // Para autenticación por cookies, las cookies ya están incluidas automáticamente
    const authenticatedResponse = await secureFetch(configUrl, {
      headers: authHeaders,
      credentials: 'include' // Importante: incluir cookies siempre
    });

    if (authenticatedResponse.ok) {
      // console.log('🎉 Acceso autenticado exitoso');
      return {
        success: true,
        message: 'Autenticación JWT exitosa con cookies',
        requiresAuth: true,
        token: authResult.token,
        expiresAt: authResult.expiresAt
      };
    } else {
      console.error(`❌ Acceso denegado después de login: ${authenticatedResponse.status}`);
      return {
        success: false,
        message: `Acceso denegado después de login exitoso (HTTP ${authenticatedResponse.status})`,
        requiresAuth: true,
        error: `HTTP ${authenticatedResponse.status}`
      };
    }

  } catch (error) {
    console.error('❌ Error validando conexión:', error);
    return {
      success: false,
      message: `Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      requiresAuth: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Verificar si un token JWT sigue siendo válido
 */
export async function verifyJWTToken(baseUrl: string, token: string): Promise<boolean> {
  try {
    const response = await secureFetch(`${baseUrl}/api/config`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Obtener headers de autenticación apropiados para un servidor
 */
export function getAuthHeaders(server: {
  auth_type?: string;
  username?: string;
  password?: string;
  jwt_token?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Exalink-Hub/1.0'
  };

  // Si hay un JWT token válido, usarlo
  if (server.jwt_token && server.jwt_token !== 'cookie-based-auth') {
    headers.Authorization = `Bearer ${server.jwt_token}`;
  }
  
  // Para autenticación por cookies (jwt_token === 'cookie-based-auth')
  // las cookies se manejan automáticamente con credentials: 'include'
  // en el secure-fetch, no necesitamos headers adicionales

  return headers;
}