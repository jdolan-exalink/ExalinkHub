/**
 * Sistema de almacenamiento local para archivos LPR
 * Gestiona la descarga y almacenamiento de snapshots, clips y recortes
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class LPRFileManager {
  private baseDir: string;
  private snapshotsDir: string;
  private clipsDir: string;
  private cropsDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'data', 'lpr-files');
    this.snapshotsDir = path.join(this.baseDir, 'snapshots');
    this.clipsDir = path.join(this.baseDir, 'clips');
    this.cropsDir = path.join(this.baseDir, 'crops');

    this.initializeDirectories();
  }

  private initializeDirectories(): void {
    const dirs = [this.baseDir, this.snapshotsDir, this.clipsDir, this.cropsDir];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Directorio creado: ${dir}`);
      }
    });
  }

  // Generar nombre de archivo único
  private generateFileName(eventId: string, fileType: 'snapshot' | 'clip' | 'crop', extension: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(eventId).digest('hex').substring(0, 8);
    return `${timestamp}-${hash}-${fileType}.${extension}`;
  }

  // Obtener directorio según tipo de archivo
  private getDirectoryForType(fileType: 'snapshot' | 'clip' | 'crop'): string {
    switch (fileType) {
      case 'snapshot': return this.snapshotsDir;
      case 'clip': return this.clipsDir;
      case 'crop': return this.cropsDir;
    }
  }

  // Descargar archivo desde Frigate
  public async downloadFile(
    eventId: string,
    fileType: 'snapshot' | 'clip' | 'crop',
    sourceUrl: string,
    extension: string = 'jpg'
  ): Promise<{ localPath: string; fileSize: number; hash: string }> {
    try {
      const fileName = this.generateFileName(eventId, fileType, extension);
      const targetDir = this.getDirectoryForType(fileType);
      const localPath = path.join(targetDir, fileName);

      console.log(`📥 Descargando ${fileType} para evento ${eventId}...`);
      console.log(`   Origen: ${sourceUrl}`);
      console.log(`   Destino: ${localPath}`);

      const response = await fetch(sourceUrl);
      
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Calcular hash del archivo
      const hash = crypto.createHash('sha256').update(uint8Array).digest('hex');
      
      // Escribir archivo
      fs.writeFileSync(localPath, uint8Array);
      
      const fileSize = fs.statSync(localPath).size;
      
      console.log(`✓ ${fileType} descargado: ${fileSize} bytes`);
      
      return {
        localPath,
        fileSize,
        hash
      };

    } catch (error) {
      console.error(`❌ Error descargando ${fileType} para evento ${eventId}:`, error);
      throw error;
    }
  }

  // Verificar si un archivo existe localmente
  public fileExists(localPath: string): boolean {
    return fs.existsSync(localPath);
  }

  // Obtener información de archivo
  public getFileInfo(localPath: string): { size: number; mtime: Date } | null {
    try {
      const stats = fs.statSync(localPath);
      return {
        size: stats.size,
        mtime: stats.mtime
      };
    } catch {
      return null;
    }
  }

  // Limpiar archivos antiguos
  public cleanupOldFiles(daysToKeep: number = 30): { deleted: number; errors: number } {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    let deleted = 0;
    let errors = 0;

    const dirs = [this.snapshotsDir, this.clipsDir, this.cropsDir];

    dirs.forEach(dir => {
      try {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            try {
              fs.unlinkSync(filePath);
              deleted++;
            } catch (err) {
              console.error(`Error eliminando archivo ${filePath}:`, err);
              errors++;
            }
          }
        });
      } catch (err) {
        console.error(`Error procesando directorio ${dir}:`, err);
        errors++;
      }
    });

    console.log(`🧹 Limpieza de archivos: ${deleted} eliminados, ${errors} errores`);
    
    return { deleted, errors };
  }

  // Obtener estadísticas de uso de disco
  public getDiskUsage(): {
    snapshots: { count: number; totalSize: number };
    clips: { count: number; totalSize: number };
    crops: { count: number; totalSize: number };
    total: { count: number; totalSize: number };
  } {
    const getDirectoryStats = (dir: string) => {
      try {
        const files = fs.readdirSync(dir);
        let count = 0;
        let totalSize = 0;

        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            count++;
            totalSize += stats.size;
          }
        });

        return { count, totalSize };
      } catch {
        return { count: 0, totalSize: 0 };
      }
    };

    const snapshots = getDirectoryStats(this.snapshotsDir);
    const clips = getDirectoryStats(this.clipsDir);
    const crops = getDirectoryStats(this.cropsDir);

    const total = {
      count: snapshots.count + clips.count + crops.count,
      totalSize: snapshots.totalSize + clips.totalSize + crops.totalSize
    };

    return { snapshots, clips, crops, total };
  }

  // Formatear tamaño de archivo para mostrar
  public static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Crear URL para servir archivo local
  public getLocalFileUrl(localPath: string, fileType: 'snapshot' | 'clip' | 'crop'): string {
    const relativePath = path.relative(this.baseDir, localPath);
    return `/api/lpr/files/${fileType}/${encodeURIComponent(relativePath)}`;
  }

  // Obtener ruta absoluta desde URL relativa
  public getAbsolutePathFromUrl(url: string): string | null {
    try {
      // URL format: /api/lpr/files/{type}/{relativePath}
      const parts = url.split('/');
      if (parts.length >= 5 && parts[2] === 'lpr' && parts[3] === 'files') {
        const relativePath = decodeURIComponent(parts.slice(5).join('/'));
        return path.join(this.baseDir, relativePath);
      }
      return null;
    } catch {
      return null;
    }
  }
}

// Singleton para acceso global
let fileManagerInstance: LPRFileManager | null = null;

export function getLPRFileManager(): LPRFileManager {
  if (!fileManagerInstance) {
    fileManagerInstance = new LPRFileManager();
  }
  return fileManagerInstance;
}

export default LPRFileManager;