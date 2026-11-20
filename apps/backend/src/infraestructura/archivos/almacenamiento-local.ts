import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ArchivoGuardado {
  url: string;
  nombre: string;
  tamano: number;
}

/** Adaptador local de desarrollo; se puede sustituir por almacenamiento durable. */
export class AlmacenamientoLocal {
  private readonly carpeta: string;

  constructor(carpetaConfigurada?: string) {
    this.carpeta = path.resolve(carpetaConfigurada ?? path.join(process.cwd(), 'archivos_subidos'));
  }

  async guardar(contenido: Buffer, extension: string): Promise<ArchivoGuardado> {
    await mkdir(this.carpeta, { recursive: true });
    const nombre = `${randomUUID()}${extension}`;
    await writeFile(path.join(this.carpeta, nombre), contenido, { flag: 'wx' });
    return { url: `/archivos/${nombre}`, nombre, tamano: contenido.length };
  }
}
