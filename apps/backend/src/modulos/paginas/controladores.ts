import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { Usuario } from '../usuarios/usuario.modelo';
import { PaginasServicio } from './servicios';

function usuarioActual(solicitud: Request): Usuario {
  if (!solicitud.usuario) throw new ErrorHttp(401, 'Falta el token de autenticación.');
  return solicitud.usuario;
}

export class PaginasControlador {
  constructor(private readonly servicio: PaginasServicio) {}

  listar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json({ paginas: await this.servicio.listar(usuarioActual(solicitud)) });
    } catch (error) {
      return siguiente(error);
    }
  };

  crear = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const pagina = await this.servicio.crear(usuarioActual(solicitud), solicitud.body ?? {});
      return respuesta.status(201).json({ pagina });
    } catch (error) {
      return siguiente(error);
    }
  };

  actualizar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const pagina = await this.servicio.actualizar(usuarioActual(solicitud), solicitud.params.id, solicitud.body ?? {});
      return respuesta.json({ pagina });
    } catch (error) {
      return siguiente(error);
    }
  };

  cambiarVerificacion = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const pagina = await this.servicio.cambiarVerificacion(usuarioActual(solicitud), solicitud.params.id, solicitud.body?.verificada, solicitud.body?.solicitud);
      return respuesta.json({ pagina });
    } catch (error) {
      return siguiente(error);
    }
  };

  seguir = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.seguir(usuarioActual(solicitud), solicitud.params.id));
    } catch (error) {
      return siguiente(error);
    }
  };

  dejarDeSeguir = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.dejarDeSeguir(usuarioActual(solicitud), solicitud.params.id));
    } catch (error) {
      return siguiente(error);
    }
  };
}
