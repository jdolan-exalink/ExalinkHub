/**
 * Configuración de desarrollo para Frigate Studio
 */

export const DEV_CONFIG = {
  // Indica si estamos en modo de desarrollo
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Configuración del reproductor de video
  videoPlayer: {
    // Por ahora usamos datos simulados para el reproductor
    useSimulatedData: true,
    
    // Mensaje para el usuario sobre el estado del streaming
    streamingMessage: 'Video streaming requiere configuración completa de Frigate server',
    
    // Funcionalidades habilitadas
    features: {
      timeline: true,
      eventMarkers: true,
      downloadClips: true,
      speedControls: true,
      videoPlayback: false // Se habilitará con Frigate real
    }
  },
  
  // URLs de desarrollo por defecto
  defaultUrls: {
    frigateServer: 'http://localhost:5000',
    webrtcServer: 'ws://localhost:8083'
  }
};

export default DEV_CONFIG;