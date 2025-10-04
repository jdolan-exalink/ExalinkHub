/**
 * API para probar conexión de servidor
 * POST /api/config/servers/[id]/test - Probar conexión paso a paso
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';
import { validateServerConnection, getAuthHeaders } from '@/lib/frigate-auth';
import { secureFetch } from '@/lib/secure-fetch';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

interface TestStep {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  duration?: number;
  error?: string;
  details?: any;
}

/**
 * POST /api/config/servers/[id]/test
 * Probar conexión completa paso a paso
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const serverId = parseInt(id);
  
  if (isNaN(serverId)) {
    return NextResponse.json(
      { error: 'ID de servidor inválido' },
      { status: 400 }
    );
  }

  const db = getConfigDatabase();
  const server = db.getServerById(serverId);

  if (!server) {
    return NextResponse.json(
      { error: 'Servidor no encontrado' },
      { status: 404 }
    );
  }

  const steps: TestStep[] = [
    { step: 'Validación de URL', status: 'pending', message: 'Validando formato de URL...' },
    { step: 'Conectividad de Red', status: 'pending', message: 'Probando conectividad de red...' },
    { step: 'Autenticación', status: 'pending', message: 'Verificando credenciales...' },
    { step: 'API de Frigate', status: 'pending', message: 'Probando endpoints de API...' },
    { step: 'Estado del Sistema', status: 'pending', message: 'Obteniendo métricas del sistema...' }
  ];

  // Función para pausa de 1 segundo
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Variables para mantener estado de autenticación entre pasos
  let validationResult: any;
  let authHeaders: Record<string, string> = {};
  let useCookieAuth = false;

  try {
    const baseUrl = `${server.protocol}://${server.url}:${server.port}`;
    
    // Paso 1: Validar URL
    const startTime = Date.now();
    try {
      new URL(baseUrl);
      steps[0].status = 'success';
      steps[0].message = `URL válida: ${baseUrl}`;
      steps[0].duration = Date.now() - startTime;
    } catch (error) {
      steps[0].status = 'error';
      steps[0].message = 'Formato de URL inválido';
      steps[0].duration = Date.now() - startTime;
      return NextResponse.json({ steps });
    }

    // Pausa de 1 segundo
    await sleep(1000);

    // Paso 2: Conectividad de Red
    const connectStart = Date.now();
    try {
      // Usar autenticación si está disponible del paso 3
      const connectHeaders = useCookieAuth ? authHeaders : getAuthHeaders(server);
      const fetchOptions: RequestInit = {
        headers: connectHeaders,
        signal: undefined
      };
      
      // Si usamos autenticación por cookies, incluir credentials
      if (useCookieAuth) {
        fetchOptions.credentials = 'include';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      fetchOptions.signal = controller.signal;

      const response = await secureFetch(`${baseUrl}/api/version`, fetchOptions);

      clearTimeout(timeoutId);

      if (response.ok) {
        try {
          const versionData = await response.json();
          steps[1].status = 'success';
          steps[1].message = `Conectividad exitosa - Frigate v${versionData.version || 'unknown'}`;
          steps[1].details = { 
            version: versionData,
            responseTime: Date.now() - connectStart,
            authenticated: useCookieAuth || !!server.jwt_token
          };
        } catch (jsonError) {
          // Respuesta exitosa pero no es JSON válido
          steps[1].status = 'success';
          steps[1].message = 'Conectividad exitosa - Respuesta no JSON';
          steps[1].details = { 
            note: 'Servidor responde pero no con JSON válido',
            responseTime: Date.now() - connectStart,
            authenticated: useCookieAuth || !!server.jwt_token
          };
        }
      } else if (response.status === 401 && !useCookieAuth && !server.jwt_token) {
        // 401 sin autenticación es normal, intentaremos autenticar en el paso 3
        steps[1].status = 'success';
        steps[1].message = 'Conectividad OK - Requiere autenticación (se validará en paso 3)';
        steps[1].details = { 
          status: response.status,
          note: 'Servidor requiere autenticación',
          responseTime: Date.now() - connectStart
        };
      } else {
        steps[1].status = 'error';
        steps[1].message = `Error HTTP: ${response.status} ${response.statusText}`;
        steps[1].error = `El servidor respondió con código ${response.status}`;
        steps[1].details = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        };
      }
      steps[1].duration = Date.now() - connectStart;
    } catch (error) {
      steps[1].status = 'error';
      if (error instanceof Error && error.name === 'AbortError') {
        steps[1].message = 'Timeout de conexión (5 segundos)';
        steps[1].error = 'El servidor no respondió dentro del tiempo límite';
      } else {
        steps[1].message = 'Error de conectividad';
        steps[1].error = error instanceof Error ? error.message : 'Error desconocido';
      }
      steps[1].details = {
        errorType: error?.constructor?.name,
        baseUrl: baseUrl,
        endpoint: '/api/version'
      };
      steps[1].duration = Date.now() - connectStart;
    }

    // Pausa de 1 segundo
    await sleep(1000);

    // Paso 3: Autenticación y Validación Completa usando el método unificado
    const authStart = Date.now();
    
    try {
      // console.log(`🔐 Iniciando validación de autenticación para servidor: ${server.name}`);
      
      validationResult = await validateServerConnection(
        baseUrl,
        {
          username: server.username,
          password: server.password
        }
      );
      
      if (validationResult.success) {
        steps[2].status = 'success';
        steps[2].message = `Autenticación automática exitosa`;
        
        // Determinar el tipo de autenticación para usar en pasos posteriores
        if (validationResult.token === 'cookie-based-auth') {
          useCookieAuth = true;
          authHeaders = {
            'Content-Type': 'application/json',
            'User-Agent': 'Exalink-Hub/1.0'
          };
          // console.log('🍪 Usando autenticación por cookies para pasos posteriores');
        } else if (validationResult.token) {
          authHeaders = {
            'Content-Type': 'application/json',
            'User-Agent': 'Exalink-Hub/1.0',
            'Authorization': `Bearer ${validationResult.token}`
          };
          // console.log('🔑 Usando token JWT para pasos posteriores');
        }
        
        // Si obtuvimos un nuevo token JWT, actualizarlo en la base de datos
        if (validationResult.token) {
          const expiresAt = new Date(Date.now() + 86400000).toISOString(); // 24 horas por defecto
          db.updateServerJWT(serverId, validationResult.token, expiresAt);
          console.log('✅ Token JWT actualizado en base de datos');
        }
      } else {
        steps[2].status = 'error';
        steps[2].message = 'Error de autenticación';
        steps[2].error = validationResult.error || 'Error desconocido';
        steps[2].details = {
          authType: 'auto', // Autenticación automática
          username: server.username,
          hasPassword: !!server.password,
          baseUrl: baseUrl
        };
      }
      steps[2].duration = Date.now() - authStart;
    } catch (error) {
      steps[2].status = 'error';
      steps[2].message = 'Error validando autenticación';
      steps[2].error = error instanceof Error ? error.message : 'Error desconocido';
      steps[2].details = {
        authType: 'auto', // Autenticación automática
        errorType: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : undefined
      };
      steps[2].duration = Date.now() - authStart;
    }

    // Pausa de 1 segundo
    await sleep(1000);

    // Paso 4: API de Frigate
    const apiStart = Date.now();
    try {
      // Usar la autenticación configurada en el paso 3
      const apiHeaders = useCookieAuth ? authHeaders : getAuthHeaders(server);
      const fetchOptions: RequestInit = {
        headers: apiHeaders
      };
      
      // Si usamos autenticación por cookies, incluir credentials
      if (useCookieAuth) {
        fetchOptions.credentials = 'include';
      }

      const [configRes, statsRes] = await Promise.allSettled([
        secureFetch(`${baseUrl}/api/config`, fetchOptions),
        secureFetch(`${baseUrl}/api/stats`, fetchOptions)
      ]);

      const successCount = [configRes, statsRes].filter(
        result => result.status === 'fulfilled' && result.value.ok
      ).length;

      if (successCount === 2) {
        steps[3].status = 'success';
        steps[3].message = 'Todos los endpoints de API funcionan correctamente';
      } else if (successCount > 0) {
        steps[3].status = 'success';
        steps[3].message = `${successCount}/2 endpoints funcionando`;
      } else {
        steps[3].status = 'error';
        steps[3].message = 'No se pudo acceder a los endpoints de API';
      }
      steps[3].duration = Date.now() - apiStart;
    } catch (error) {
      steps[3].status = 'error';
      steps[3].message = 'Error probando API de Frigate';
      steps[3].duration = Date.now() - apiStart;
    }

    // Pausa de 1 segundo
    await sleep(1000);

    // Paso 5: Estado del Sistema - Usar métricas de la validación si están disponibles
    const statsStart = Date.now();
    try {
      let stats;
      
      // Si ya tenemos métricas de la validación, usarlas
      if (validationResult?.success && validationResult.metrics) {
        stats = validationResult.metrics;
        // console.log('📊 Usando métricas de la validación previa');
      } else {
        // Si no, hacer una nueva consulta usando la autenticación del paso 3
        const statsHeaders = useCookieAuth ? authHeaders : getAuthHeaders(server);
        const fetchOptions: RequestInit = {
          headers: statsHeaders
        };
        
        // Si usamos autenticación por cookies, incluir credentials
        if (useCookieAuth) {
          fetchOptions.credentials = 'include';
        }
        
        const statsResponse = await secureFetch(`${baseUrl}/api/stats`, fetchOptions);
        
        if (!statsResponse.ok) {
          throw new Error(`Error HTTP ${statsResponse.status}: ${statsResponse.statusText}`);
        }
        
        try {
          stats = await statsResponse.json();
        } catch (jsonError) {
          throw new Error(`Respuesta no es JSON válido: ${jsonError instanceof Error ? jsonError.message : 'Error desconocido'}`);
        }
      }
      
      // Extraer métricas del sistema de Frigate según la documentación
      
      // CPU: Usar el valor de frigate.full_system que representa el uso total del sistema
      const frigateFullSystem = stats.cpu_usages?.['frigate.full_system'];
      const cpuUsage = frigateFullSystem ? parseFloat(frigateFullSystem.cpu) : 0;
      
      // RAM: También desde frigate.full_system
      const memoryUsage = frigateFullSystem ? parseFloat(frigateFullSystem.mem) : 0;
      
      // Disco: Usar el almacenamiento principal (recordings o clips)
      const storageKeys = Object.keys(stats.service?.storage || {});
      
      const recordingsStorage = stats.service?.storage?.['/media/frigate/recordings'] || 
                               stats.service?.storage?.['/tmp/cache'] ||
                               Object.values(stats.service?.storage || {})[0];
      
      let diskUsage = 0;
      if (recordingsStorage && recordingsStorage.total && recordingsStorage.used) {
        diskUsage = (recordingsStorage.used / recordingsStorage.total) * 100;
      }
      
      // GPU: Extraer de gpu_usages si está disponible
      const gpuData = stats.gpu_usages ? Object.values(stats.gpu_usages)[0] as any : null;
      const gpuUsage = gpuData?.mem ? parseFloat(gpuData.mem.replace('%', '')) : 0;
      
      // Actualizar estado en la base de datos
      db.updateServerStatus(serverId, {
        cpu_usage: cpuUsage,
        gpu_usage: gpuUsage,
        memory_usage: memoryUsage,
        disk_usage: diskUsage,
        api_status: 'online',
        last_check: new Date().toISOString()
      });

      steps[4].status = 'success';
      steps[4].message = `Sistema operativo: CPU ${cpuUsage.toFixed(1)}%, RAM ${memoryUsage.toFixed(1)}%, Disco ${diskUsage.toFixed(1)}%, GPU ${gpuUsage.toFixed(1)}% - Métricas actualizadas`;
      steps[4].duration = Date.now() - statsStart;
    } catch (error) {
      console.error('❌ Error obteniendo métricas:', error);
      steps[4].status = 'error';
      steps[4].message = error instanceof Error ? error.message : 'Error obteniendo estado del sistema';
      steps[4].duration = Date.now() - statsStart;
    }

    return NextResponse.json({ steps });
  } catch (error) {
    console.error('Error en test de conexión:', error);
    return NextResponse.json(
      { error: 'Error interno durante el test' },
      { status: 500 }
    );
  }
}