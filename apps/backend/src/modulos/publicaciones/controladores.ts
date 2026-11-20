import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { decodificarCursor, leerLimite } from '../../comun/paginacion';
import { enumerado } from '../../comun/validacion';
import { Usuario } from '../usuarios/usuario.modelo';
import { CANALES, CanalPublicacion } from './publicacion.modelo';
import { FiltrosMuro, PublicacionesServicio } from './servicios';

const VISTAS = ['global', 'sede', 'siguiendo', 'propias', 'respondidas'] as const;

function usuarioActual(solicitud: Request): Usuario {
  if (!solicitud.usuario) {
    throw new ErrorHttp(401, 'Falta el token de autenticación.');
  }
  return solicitud.usuario;
}

export class PublicacionesControlador {
  constructor(private readonly servicio: PublicacionesServicio) {}

  crear = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const publicacion = await this.servicio.crear(usuarioActual(solicitud), solicitud.body ?? {});
      return respuesta.status(201).json(publicacion);
    } catch (error) {
      return siguiente(error);
    }
  };

  listar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const vista =
        solicitud.query.vista === undefined
          ? 'global'
          : enumerado(solicitud.query.vista, 'vista', VISTAS);

      const hubChannel =
        solicitud.query.hubChannel === undefined
          ? undefined
          : enumerado(solicitud.query.hubChannel, 'hubChannel', CANALES);

      const filtros: FiltrosMuro = {
        vista,
        paginaId: typeof solicitud.query.pageId === 'string' ? solicitud.query.pageId : undefined,
        campus:
          typeof solicitud.query.campus === 'string' ? solicitud.query.campus : undefined,
        hubChannel: hubChannel as CanalPublicacion | undefined,
        cursor: decodificarCursor(solicitud.query.cursor),
        limite: leerLimite(solicitud.query.limite, 15, 50),
      };

      const resultado = await this.servicio.listar(usuarioActual(solicitud), filtros);
      return respuesta.json(resultado);
    } catch (error) {
      return siguiente(error);
    }
  };

  detalle = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.detalle(usuarioActual(solicitud), solicitud.params.id)
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  editar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.editar(usuarioActual(solicitud), solicitud.params.id, solicitud.body ?? {})
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  eliminar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.eliminar(usuarioActual(solicitud), solicitud.params.id)
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  darLike = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.darLike(usuarioActual(solicitud), solicitud.params.id)
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  quitarLike = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.quitarLike(usuarioActual(solicitud), solicitud.params.id)
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  reaccionar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.reaccionar(usuarioActual(solicitud), solicitud.params.id, solicitud.body?.type));
    } catch (error) { return siguiente(error); }
  };

  listarGuardadas = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try { respuesta.json(await this.servicio.listarGuardadas(usuarioActual(solicitud))); }
    catch (error) { siguiente(error); }
  };

  guardarReferencia = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try { respuesta.json(await this.servicio.guardarReferencia(usuarioActual(solicitud), solicitud.params.id, solicitud.method === 'PUT')); }
    catch (error) { siguiente(error); }
  };

  votar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      respuesta.json(await this.servicio.votar(usuarioActual(solicitud), solicitud.params.id, solicitud.body?.opcion));
    } catch (error) { siguiente(error); }
  };

  comentar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const comentario = await this.servicio.comentar(
        usuarioActual(solicitud),
        solicitud.params.id,
        solicitud.body ?? {}
      );
      return respuesta.status(201).json(comentario);
    } catch (error) {
      return siguiente(error);
    }
  };

  eliminarComentario = async (
    solicitud: Request,
    respuesta: Response,
    siguiente: NextFunction
  ) => {
    try {
      return respuesta.json(
        await this.servicio.eliminarComentario(
          usuarioActual(solicitud),
          solicitud.params.id,
          solicitud.params.comentarioId
        )
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  marcarSolucion = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.marcarSolucion(
          usuarioActual(solicitud),
          solicitud.params.id,
          solicitud.params.comentarioId
        )
      );
    } catch (error) {
      return siguiente(error);
    }
  };
}
