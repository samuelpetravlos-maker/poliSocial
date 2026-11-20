import { RequestHandler } from 'express';
import { Db } from 'mongodb';
import { RolUsuario, Usuario } from '../modulos/usuarios/usuario.modelo';
import { ErrorHttp } from './errores';
import { verificarTokenLocal } from './credenciales';
import { CapacidadPoli, tieneCapacidad } from './permisos';

import { resolverIdentidadSocial } from '../modulos/paginas/identidades';

export interface IdentidadToken {
  paginaId?: string;
  expira?: number;
  usuarioId: string;
  email?: string;
  emailVerificado?: boolean;
  modoDesarrollo: boolean;
  tokenLocal?: boolean;
  sessionVersion?: number;
}

export interface Autenticacion {
  autenticarToken: RequestHandler;
  cargarUsuario: RequestHandler;
  autorizar: (...roles: RolUsuario[]) => RequestHandler;
  autorizarCapacidad: (capacidad: CapacidadPoli) => RequestHandler;
}

interface CuentaFirebase {
  localId: string;
  email?: string;
  emailVerified?: boolean | string;
}

export async function verificarToken(token: string): Promise<IdentidadToken> {
  const identidadLocal = verificarTokenLocal(token);
  if (identidadLocal) {
    return { expira: identidadLocal.expira, paginaId: identidadLocal.paginaId, usuarioId: identidadLocal.usuarioId, modoDesarrollo: true, tokenLocal: true, sessionVersion: identidadLocal.versionSesion };
  }

  const apiKey = process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    throw new ErrorHttp(401, 'El token de sesión no es válido o expiró.');
  }

  let respuesta: Awaited<ReturnType<typeof fetch>>;
  try {
    respuesta = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
  } catch {
    throw new ErrorHttp(503, 'No fue posible validar el token con Firebase.');
  }

  if (!respuesta.ok) {
    throw new ErrorHttp(401, 'Token inválido o expirado.');
  }

  const datos = (await respuesta.json()) as { users?: CuentaFirebase[] };
  const cuenta = datos.users?.[0];
  if (!cuenta?.localId) {
    throw new ErrorHttp(401, 'Token inválido o expirado.');
  }

  const carga = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { exp?: number };
  if (typeof carga.exp !== 'number') throw new ErrorHttp(401, 'El token institucional no incluye una fecha de expiración.');
  return {
    expira: carga.exp,
    usuarioId: cuenta.localId,
    email: cuenta.email,
    emailVerificado: cuenta.emailVerified === true || cuenta.emailVerified === 'true',
    modoDesarrollo: false,
  };
}

export function crearAutenticacion(baseDeDatos: Db): Autenticacion {
  const usuarios = baseDeDatos.collection<Usuario>('users');

  const autenticarToken: RequestHandler = async (solicitud, _respuesta, siguiente) => {
    try {
      const cabecera = solicitud.headers.authorization;
      if (!cabecera?.startsWith('Bearer ')) {
        throw new ErrorHttp(401, 'Falta el token de autenticación.');
      }
      const token = cabecera.slice('Bearer '.length).trim();
      if (!token) {
        throw new ErrorHttp(401, 'El token de autenticación está vacío.');
      }
      const identidad = await verificarToken(token);
      solicitud.identidad = identidad;
      solicitud.usuarioId = identidad.usuarioId;
      siguiente();
    } catch (error) {
      siguiente(error);
    }
  };

  const cargarUsuario: RequestHandler = async (solicitud, _respuesta, siguiente) => {
    try {
      if (!solicitud.usuarioId) {
        throw new ErrorHttp(401, 'Falta el token de autenticación.');
      }
      const usuario = await usuarios.findOne({ _id: solicitud.usuarioId });
      if (!usuario) {
        throw new ErrorHttp(403, 'El usuario no está registrado en Poli Social Network.');
      }
      if (usuario.status !== 'ACTIVE') {
        throw new ErrorHttp(403, 'La cuenta está suspendida o eliminada.');
      }
      if (usuario.localAuth && !solicitud.identidad?.tokenLocal) {
        throw new ErrorHttp(401, 'La contraseña de esta cuenta fue restablecida. Inicia sesión de nuevo.');
      }
      if (solicitud.identidad?.tokenLocal && (solicitud.identidad.sessionVersion ?? 0) !== (usuario.sessionVersion ?? 0)) {
        throw new ErrorHttp(401, 'La sesión fue cerrada por un cambio de seguridad. Inicia sesión de nuevo.');
      }
      if (usuario.banUntil && usuario.banUntil > new Date()) {
        throw new ErrorHttp(
          403,
          `Tu cuenta está suspendida hasta ${usuario.banUntil.toISOString()}. Motivo: ${usuario.banReason ?? 'OTRO'}.`
        );
      }
      if (usuario.banUntil && usuario.banUntil <= new Date()) {
        await usuarios.updateOne(
          { _id: usuario._id, banUntil: { $lte: new Date() } },
          { $unset: { banUntil: '', banReason: '', banDetails: '' } }
        );
        usuario.banUntil = null;
        usuario.banReason = null;
        usuario.banDetails = null;
      }
      const rutaPerfil = solicitud.method === 'GET' && solicitud.baseUrl.endsWith('/usuarios') && solicitud.path === '/mi-perfil';
      const rutaCambioClave = solicitud.method === 'PATCH' && solicitud.baseUrl.endsWith('/autenticacion') && solicitud.path === '/mi-contrasena';
      if (usuario.mustChangePassword && !rutaPerfil && !rutaCambioClave) {
        throw new ErrorHttp(403, 'PASSWORD_CHANGE_REQUIRED: cambia tu contraseña para continuar.');
      }
      const activo = await resolverIdentidadSocial(baseDeDatos, usuario, solicitud.identidad?.paginaId);
      solicitud.usuario = activo;
      solicitud.usuarioId = activo._id;
      siguiente();
    } catch (error) {
      siguiente(error);
    }
  };

  const autorizar =
    (...roles: RolUsuario[]): RequestHandler =>
    (solicitud, _respuesta, siguiente) => {
      if (!solicitud.usuario) {
        return siguiente(new ErrorHttp(401, 'Falta el token de autenticación.'));
      }
      if (!roles.includes(solicitud.usuario.role)) {
        return siguiente(new ErrorHttp(403, 'No tienes permisos para realizar esta acción.'));
      }
      return siguiente();
    };

  const autorizarCapacidad =
    (capacidad: CapacidadPoli): RequestHandler =>
    (solicitud, _respuesta, siguiente) => {
      if (!solicitud.usuario) {
        return siguiente(new ErrorHttp(401, 'Falta el token de autenticación.'));
      }
      if (!tieneCapacidad(solicitud.usuario.role, capacidad)) {
        return siguiente(new ErrorHttp(403, 'No tienes permisos para realizar esta acción.'));
      }
      return siguiente();
    };

  return { autenticarToken, cargarUsuario, autorizar, autorizarCapacidad };
}
