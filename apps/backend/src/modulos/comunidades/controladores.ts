import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { Usuario } from '../usuarios/usuario.modelo';
import { ComunidadesServicio } from './servicios';

function usuarioActual(solicitud: Request): Usuario {
  if (!solicitud.usuario) throw new ErrorHttp(401, 'Falta el token de autenticación.');
  return solicitud.usuario;
}

export class ComunidadesControlador {
  constructor(private readonly servicio: ComunidadesServicio) {}

  listar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.listar(usuarioActual(solicitud)));
    } catch (error) {
      return siguiente(error);
    }
  };

  crear = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const comunidad = await this.servicio.crear(usuarioActual(solicitud), solicitud.body ?? {});
      return respuesta.status(201).json(comunidad);
    } catch (error) {
      return siguiente(error);
    }
  };

  alternarMembresia = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.alternarMembresia(usuarioActual(solicitud), solicitud.params.id));
    } catch (error) {
      return siguiente(error);
    }
  };

  listarSolicitudes = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.listarSolicitudes(usuarioActual(solicitud), solicitud.params.id));
    } catch (error) {
      return siguiente(error);
    }
  };

  resolverSolicitud = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.resolverSolicitud(
        usuarioActual(solicitud), solicitud.params.id, solicitud.params.usuarioId, solicitud.body?.aprobar
      ));
    } catch (error) {
      return siguiente(error);
    }
  };

  invitar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.status(201).json(await this.servicio.invitar(
        usuarioActual(solicitud), solicitud.params.id, solicitud.body?.usuarioId
      ));
    } catch (error) {
      return siguiente(error);
    }
  };

  crearChat = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const resultado = await this.servicio.crearChat(usuarioActual(solicitud), solicitud.params.id);
      return respuesta.status(resultado.creado ? 201 : 200).json({ chat: resultado.chat });
    } catch (error) {
      return siguiente(error);
    }
  };
}
