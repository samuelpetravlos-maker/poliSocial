import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { Usuario } from '../usuarios/usuario.modelo';
import { ModeracionServicio } from './servicios';

function usuarioActual(solicitud: Request): Usuario {
  if (!solicitud.usuario) throw new ErrorHttp(401, 'Falta el token de autenticación.');
  return solicitud.usuario;
}

export class ModeracionControlador {
  constructor(private readonly servicio: ModeracionServicio) {}

  crearReporte = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const resultado = await this.servicio.crearReporte(usuarioActual(solicitud), solicitud.body ?? {});
      return respuesta.status(resultado.duplicado ? 200 : 201).json(resultado);
    } catch (error) {
      return siguiente(error);
    }
  };

  ejecutarAccion = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.ejecutarAccion(usuarioActual(solicitud), solicitud.body ?? {}));
    } catch (error) {
      return siguiente(error);
    }
  };

  listarReportes = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json({ reportes: await this.servicio.listarReportes(solicitud.query.estado) });
    } catch (error) {
      return siguiente(error);
    }
  };

  resolverReporte = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const resultado = await this.servicio.resolverReporte(
        usuarioActual(solicitud),
        solicitud.params.id,
        solicitud.body ?? {}
      );
      return respuesta.json(resultado);
    } catch (error) {
      return siguiente(error);
    }
  };
}
