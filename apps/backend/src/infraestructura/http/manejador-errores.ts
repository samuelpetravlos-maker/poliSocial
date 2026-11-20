import { NextFunction, Request, Response } from 'express';
import { ErrorHttp, esConflictoDuplicado } from '../../comun/errores';

export function manejarErrores(
  error: unknown,
  _solicitud: Request,
  respuesta: Response,
  _siguiente: NextFunction
): Response {
  if (error instanceof ErrorHttp) {
    return respuesta.status(error.estado).json({
      mensaje: error.message,
      ...(error.detalles === undefined ? {} : { detalles: error.detalles }),
    });
  }

  if (esConflictoDuplicado(error)) {
    return respuesta.status(409).json({ mensaje: 'Ya existe un registro con esos datos.' });
  }

  console.error('Error no controlado en Poli Social Network:', error);
  return respuesta.status(500).json({ mensaje: 'Ocurrió un error interno en el servidor.' });
}

export function rutaNoEncontrada(_solicitud: Request, respuesta: Response): Response {
  return respuesta.status(404).json({ mensaje: 'La ruta solicitada no existe.' });
}
