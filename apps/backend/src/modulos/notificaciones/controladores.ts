import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { leerLimite } from '../../comun/paginacion';
import { NotificacionesServicio } from './servicios';

function usuarioIdActual(solicitud: Request): string {
  if (!solicitud.usuarioId) {
    throw new ErrorHttp(401, 'Falta el token de autenticación.');
  }
  return solicitud.usuarioId;
}

export class NotificacionesControlador {
  constructor(private readonly servicio: NotificacionesServicio) {}

  listar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.listar(
          usuarioIdActual(solicitud),
          leerLimite(solicitud.query.limite, 30, 100)
        )
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  marcarLeida = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const actualizada = await this.servicio.marcarLeida(
        usuarioIdActual(solicitud),
        solicitud.params.id
      );
      if (!actualizada) {
        return respuesta.status(404).json({ mensaje: 'Notificación no encontrada.' });
      }
      return respuesta.json({ leida: true });
    } catch (error) {
      return siguiente(error);
    }
  };

  marcarTodasLeidas = async (
    solicitud: Request,
    respuesta: Response,
    siguiente: NextFunction
  ) => {
    try {
      const actualizadas = await this.servicio.marcarTodasLeidas(usuarioIdActual(solicitud));
      return respuesta.json({ actualizadas });
    } catch (error) {
      return siguiente(error);
    }
  };
}
