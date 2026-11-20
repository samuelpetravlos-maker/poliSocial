import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { decodificarCursor, leerLimite } from '../../comun/paginacion';
import { textoRequerido } from '../../comun/validacion';
import { Usuario } from '../usuarios/usuario.modelo';
import { ChatsServicio } from './servicios';

function usuarioActual(solicitud: Request): Usuario {
  if (!solicitud.usuario) {
    throw new ErrorHttp(401, 'Falta el token de autenticación.');
  }
  return solicitud.usuario;
}

export class ChatsControlador {
  constructor(private readonly servicio: ChatsServicio) {}

  listar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.listar(usuarioActual(solicitud)));
    } catch (error) {
      return siguiente(error);
    }
  };

  crearDirecto = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const otroId = textoRequerido(solicitud.body?.usuarioId, 'usuarioId', { max: 128 });
      return respuesta
        .status(201)
        .json(await this.servicio.crearDirecto(usuarioActual(solicitud), otroId));
    } catch (error) {
      return siguiente(error);
    }
  };

  crearGrupo = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta
        .status(201)
        .json(await this.servicio.crearGrupo(usuarioActual(solicitud), solicitud.body ?? {}));
    } catch (error) {
      return siguiente(error);
    }
  };

  listarMensajes = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const resultado = await this.servicio.listarMensajes(
        usuarioActual(solicitud),
        solicitud.params.id,
        leerLimite(solicitud.query.limite, 30, 100),
        decodificarCursor(solicitud.query.cursor)
      );
      return respuesta.json(resultado);
    } catch (error) {
      return siguiente(error);
    }
  };

  enviarMensaje = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const mensaje = await this.servicio.enviarMensaje(
        usuarioActual(solicitud),
        solicitud.params.id,
        solicitud.body ?? {}
      );
      return respuesta.status(201).json(mensaje);
    } catch (error) {
      return siguiente(error);
    }
  };

  marcarLeido = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.marcarLeido(usuarioActual(solicitud), solicitud.params.id)
      );
    } catch (error) {
      return siguiente(error);
    }
  };
}
