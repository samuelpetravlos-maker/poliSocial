import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { ArchivosServicio } from './servicios';

export class ArchivosControlador {
  constructor(private readonly servicio: ArchivosServicio) {}

  subir = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      if (!solicitud.usuario) throw new ErrorHttp(401, 'Inicia sesión para subir archivos.');
      const tipo = solicitud.headers['content-type']?.split(';')[0].toLowerCase() ?? '';
      const contenido = Buffer.isBuffer(solicitud.body) ? solicitud.body : Buffer.alloc(0);
      const nombre = solicitud.headers['x-nombre-archivo'];
      return respuesta.status(201).json(await this.servicio.guardar(tipo, contenido, nombre));
    } catch (error) {
      return siguiente(error);
    }
  };
}
