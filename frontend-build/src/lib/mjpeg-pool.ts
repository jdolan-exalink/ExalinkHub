/**
 * Connection Pool Manager para manejar el límite de 6 conexiones simultáneas MJPEG
 * Implementa rotación inteligente y prioridades para streams
 */

class MJPEGConnectionPool {
  private static instance: MJPEGConnectionPool;
  private activeConnections = new Map<string, HTMLImageElement>();
  private pendingQueue: Array<{
    cameraId: string;
    element: HTMLImageElement;
    priority: number;
    timestamp: number;
  }> = [];
  private readonly MAX_CONNECTIONS = 5; // Dejamos 1 libre para navegación
  
  private constructor() {}
  
  static getInstance(): MJPEGConnectionPool {
    if (!MJPEGConnectionPool.instance) {
      MJPEGConnectionPool.instance = new MJPEGConnectionPool();
    }
    return MJPEGConnectionPool.instance;
  }
  
  /**
   * Solicita una nueva conexión MJPEG
   */
  requestConnection(cameraId: string, element: HTMLImageElement, priority: number = 0): boolean {
    console.log(`🔌 Connection request for ${cameraId}, active: ${this.activeConnections.size}/${this.MAX_CONNECTIONS}`);
    
    // Si ya está activa, no hacer nada
    if (this.activeConnections.has(cameraId)) {
      console.log(`✅ ${cameraId} already has active connection`);
      return true;
    }
    
    // Si hay espacio disponible, conectar inmediatamente
    if (this.activeConnections.size < this.MAX_CONNECTIONS) {
      this.activateConnection(cameraId, element);
      return true;
    }
    
    // Si no hay espacio, añadir a cola con prioridad
    this.addToQueue(cameraId, element, priority);
    
    // Intentar liberar conexión de menor prioridad
    this.tryRotateConnections();
    
    return false;
  }
  
  /**
   * Libera una conexión
   */
  releaseConnection(cameraId: string): void {
    if (this.activeConnections.has(cameraId)) {
      console.log(`🔓 Releasing connection for ${cameraId}`);
      this.activeConnections.delete(cameraId);
      
      // Procesar siguiente en cola
      this.processQueue();
    }
  }
  
  /**
   * Actualiza la prioridad de una conexión (ej: cuando entra en viewport)
   */
  updatePriority(cameraId: string, newPriority: number): void {
    // Si está activa, actualizar timestamp
    if (this.activeConnections.has(cameraId)) {
      // No necesitamos hacer nada, ya está activa
      return;
    }
    
    // Si está en cola, actualizar prioridad
    const queueIndex = this.pendingQueue.findIndex(item => item.cameraId === cameraId);
    if (queueIndex !== -1) {
      this.pendingQueue[queueIndex].priority = newPriority;
      this.pendingQueue[queueIndex].timestamp = Date.now();
      this.sortQueue();
      
      // Intentar rotación si tiene alta prioridad
      if (newPriority > 5) {
        this.tryRotateConnections();
      }
    }
  }
  
  private activateConnection(cameraId: string, element: HTMLImageElement): void {
    console.log(`🟢 Activating connection for ${cameraId}`);
    this.activeConnections.set(cameraId, element);
    
    // Disparar evento personalizado para notificar que puede cargar
    window.dispatchEvent(new CustomEvent('mjpegConnectionReady', {
      detail: { cameraId }
    }));
  }
  
  private addToQueue(cameraId: string, element: HTMLImageElement, priority: number): void {
    // Remover si ya está en cola (actualización)
    this.pendingQueue = this.pendingQueue.filter(item => item.cameraId !== cameraId);
    
    // Añadir a cola
    this.pendingQueue.push({
      cameraId,
      element,
      priority,
      timestamp: Date.now()
    });
    
    this.sortQueue();
    console.log(`⏳ ${cameraId} added to queue (position ${this.pendingQueue.findIndex(item => item.cameraId === cameraId) + 1})`);
  }
  
  private sortQueue(): void {
    this.pendingQueue.sort((a, b) => {
      // Prioridad más alta primero
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // En caso de empate, más reciente primero
      return b.timestamp - a.timestamp;
    });
  }
  
  private tryRotateConnections(): void {
    if (this.pendingQueue.length === 0) return;
    
    const highestPriorityPending = this.pendingQueue[0];
    
    // Buscar conexión activa con menor prioridad para rotar
    let oldestConnection: { cameraId: string; element: HTMLImageElement } | null = null;
    let oldestTime = Date.now();
    
    for (const [cameraId, element] of this.activeConnections) {
      // Por simplicidad, rotamos la primera que encontremos
      // En una implementación más sofisticada, podríamos rastrear timestamps y prioridades
      if (!oldestConnection) {
        oldestConnection = { cameraId, element };
        break;
      }
    }
    
    if (oldestConnection && highestPriorityPending.priority > 3) {
      console.log(`🔄 Rotating connection: ${oldestConnection.cameraId} → ${highestPriorityPending.cameraId}`);
      
      // Liberar conexión antigua
      this.releaseConnection(oldestConnection.cameraId);
      
      // Activar nueva conexión
      this.processQueue();
    }
  }
  
  private processQueue(): void {
    if (this.pendingQueue.length === 0) return;
    if (this.activeConnections.size >= this.MAX_CONNECTIONS) return;
    
    const next = this.pendingQueue.shift();
    if (next) {
      this.activateConnection(next.cameraId, next.element);
    }
  }
  
  /**
   * Actualiza la visibilidad de una cámara para ajustar su prioridad
   */
  updateVisibility(cameraId: string, isVisible: boolean): void {
    // Buscar en la cola de pendientes y actualizar prioridad
    const pendingIndex = this.pendingQueue.findIndex(item => item.cameraId === cameraId);
    if (pendingIndex !== -1) {
      this.pendingQueue[pendingIndex].priority = isVisible ? 3 : 1;
      this.sortQueue();
      console.log(`👁️ Updated visibility for ${cameraId}: ${isVisible ? 'visible' : 'hidden'}`);
    }
  }

  /**
   * Estado actual del pool para debugging
   */
  getStatus(): { active: string[]; pending: string[]; } {
    return {
      active: Array.from(this.activeConnections.keys()),
      pending: this.pendingQueue.map(item => `${item.cameraId}(p:${item.priority})`)
    };
  }
}

export default MJPEGConnectionPool;