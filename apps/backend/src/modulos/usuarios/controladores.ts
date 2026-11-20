import { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { decodificarCursor, leerLimite } from '../../comun/paginacion';
import { Sede, Usuario } from './usuario.modelo';
import { UsuariosServicio } from './servicios';

function usuarioActual(solicitud: Request): Usuario {
  if (!solicitud.usuario) {
    throw new ErrorHttp(401, 'Falta el token de autenticación.');
  }
  return solicitud.usuario;
}

export class UsuariosControlador {
  constructor(private readonly servicio: UsuariosServicio) {}

  registrar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      if (!solicitud.identidad) {
        throw new ErrorHttp(401, 'Falta el token de autenticación.');
      }
      const usuario = await this.servicio.registrar(solicitud.identidad, solicitud.body ?? {});
      return respuesta.status(201).json(usuario);
    } catch (error) {
      return siguiente(error);
    }
  };

  miPerfil = (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(this.servicio.miPerfil(usuarioActual(solicitud)));
    } catch (error) {
      return siguiente(error);
    }
  };

  obtenerPerfil = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const usuario = await this.servicio.obtenerPerfil(solicitud.params.id);
      if (!usuario) return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
      return respuesta.json(usuario);
    } catch (error) {
      return siguiente(error);
    }
  };

  buscar = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const busqueda =
        typeof solicitud.query.busqueda === 'string' ? solicitud.query.busqueda.trim() : undefined;
      const campus =
        typeof solicitud.query.campus === 'string'
          ? (solicitud.query.campus as Sede)
          : undefined;
      const program =
        typeof solicitud.query.program === 'string' ? solicitud.query.program : undefined;

      const usuarios = await this.servicio.buscar({
        busqueda: busqueda || undefined,
        campus,
        program,
        limite: leerLimite(solicitud.query.limite, 20, 50),
      });
      return respuesta.json({ usuarios });
    } catch (error) {
      return siguiente(error);
    }
  };

  actualizarPerfil = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const actualizado = await this.servicio.actualizarPerfil(
        usuarioActual(solicitud),
        solicitud.body ?? {}
      );
      return respuesta.json(actualizado ? this.servicio.miPerfil(actualizado) : null);
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
      return respuesta.json(
        await this.servicio.dejarDeSeguir(usuarioActual(solicitud), solicitud.params.id)
      );
    } catch (error) {
      return siguiente(error);
    }
  };

  seguidores = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const resultado = await this.servicio.listarSeguidores(
        solicitud.params.id,
        leerLimite(solicitud.query.limite, 20, 50),
        decodificarCursor(solicitud.query.cursor)
      );
      return respuesta.json(resultado);
    } catch (error) {
      return siguiente(error);
    }
  };

  seguidos = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const resultado = await this.servicio.listarSeguidos(
        solicitud.params.id,
        leerLimite(solicitud.query.limite, 20, 50),
        decodificarCursor(solicitud.query.cursor)
      );
      return respuesta.json(resultado);
    } catch (error) {
      return siguiente(error);
    }
  };

  sugerencias = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      const usuarios = await this.servicio.sugerencias(
        usuarioActual(solicitud),
        leerLimite(solicitud.query.limite, 5, 20)
      );
      return respuesta.json({ usuarios });
    } catch (error) {
      return siguiente(error);
    }
  };

  bloquear = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(await this.servicio.bloquear(usuarioActual(solicitud), solicitud.params.id));
    } catch (error) {
      return siguiente(error);
    }
  };

  desbloquear = async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    try {
      return respuesta.json(
        await this.servicio.desbloquear(usuarioActual(solicitud), solicitud.params.id)
      );
    } catch (error) {
      return siguiente(error);
    }
  };
}
