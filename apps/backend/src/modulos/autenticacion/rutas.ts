import { cambiarClaveFirebase } from './contrasena-institucional';
import { resolverIdentidadSocial } from '../paginas/identidades';
import { Router } from 'express';
import { Db } from 'mongodb';
import { ErrorHttp } from '../../comun/errores';
import {
  crearTokenLocal,
  hashearContrasena,
  validarNuevaContrasena,
  verificarContrasena,
} from '../../comun/credenciales';
import { crearAutenticacion } from '../../comun/autenticacion';
import { NotificacionesRepositorio } from '../notificaciones/notificaciones.repositorio';
import { BloqueosRepositorio } from '../usuarios/bloqueos.repositorio';
import { SeguidoresRepositorio } from '../usuarios/seguidores.repositorio';
import { Usuario } from '../usuarios/usuario.modelo';
import { UsuariosControlador } from '../usuarios/controladores';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { UsuariosServicio } from '../usuarios/servicios';

export function crearRutasAutenticacion(baseDeDatos: Db): Router {
  const rutas = Router();
  const usuarios = baseDeDatos.collection<Usuario>('users');
  const servicioUsuarios = new UsuariosServicio(
    new UsuariosRepositorio(baseDeDatos),
    new SeguidoresRepositorio(baseDeDatos),
    new BloqueosRepositorio(baseDeDatos),
    new NotificacionesRepositorio(baseDeDatos)
  );
  const controladorUsuarios = new UsuariosControlador(servicioUsuarios);
  const autenticacion = crearAutenticacion(baseDeDatos);

  rutas.post('/registro', async (solicitud, respuesta, siguiente) => {
    try {
      const datos = solicitud.body ?? {};
      const usuarioNombre = typeof datos.username === 'string' ? datos.username.trim().toLowerCase() : '';
      const contrasena = validarNuevaContrasena(datos.password);
      const hash = await hashearContrasena(contrasena);
      const identidad = {
        usuarioId: `local_${usuarioNombre}`,
        email: typeof datos.email === 'string' ? datos.email.toLowerCase() : undefined,
        emailVerificado: false,
        modoDesarrollo: true,
        tokenLocal: true,
      };
      const usuario = await servicioUsuarios.registrar(identidad, datos, hash);
      return respuesta.status(201).json({
        token: crearTokenLocal(usuario._id, usuario.sessionVersion ?? 0),
        usuario: servicioUsuarios.miPerfil(usuario),
      });
    } catch (error) {
      return siguiente(error);
    }
  });

  rutas.post('/sesion', async (solicitud, respuesta, siguiente) => {
    try {
      const identificador =
        typeof solicitud.body?.identificador === 'string'
          ? solicitud.body.identificador.trim().toLowerCase()
          : '';
      const contrasena =
        typeof solicitud.body?.password === 'string' ? solicitud.body.password : '';
      if (!identificador || !contrasena) {
        throw new ErrorHttp(400, 'Ingresa tu usuario y contraseña.');
      }

      const usuario = await usuarios.findOne({
        $or: [{ username: identificador }, { email: identificador }],
      });
      if (!usuario?.passwordHash || !usuario.localAuth) {
        throw new ErrorHttp(404, 'Esta cuenta usa autenticación institucional.');
      }
      if (!(await verificarContrasena(contrasena, usuario.passwordHash))) {
        throw new ErrorHttp(401, 'Usuario o contraseña incorrectos.');
      }
      if (usuario.status !== 'ACTIVE') {
        throw new ErrorHttp(403, 'La cuenta está suspendida o eliminada.');
      }
      if (usuario.banUntil && usuario.banUntil > new Date()) {
        throw new ErrorHttp(
          403,
          `La cuenta está suspendida hasta ${usuario.banUntil.toISOString()}. Motivo: ${usuario.banReason ?? 'OTRO'}.`
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

      const activo = await resolverIdentidadSocial(baseDeDatos, usuario);
      return respuesta.json({
        token: crearTokenLocal(usuario._id, usuario.sessionVersion ?? 0),
        usuario: servicioUsuarios.miPerfil(activo),
      });
    } catch (error) {
      return siguiente(error);
    }
  });

  rutas.patch(
    '/mi-contrasena',
    autenticacion.autenticarToken,
    autenticacion.cargarUsuario,
    async (solicitud, respuesta, siguiente) => {
      try {
        const usuario = solicitud.usuario;
        if (!usuario) throw new ErrorHttp(401, 'Falta el token de autenticación.');
        if (usuario.paginaDelegada || (usuario.role !== 'USER' && !usuario.mustChangePassword)) {
          throw new ErrorHttp(403, 'Esta identidad no admite un cambio de contraseña personal.');
        }
        const actual = typeof solicitud.body?.passwordActual === 'string' ? solicitud.body.passwordActual : '';
        const nueva = validarNuevaContrasena(solicitud.body?.passwordNueva);
        if (!usuario.localAuth && !usuario.passwordHash && !solicitud.identidad?.tokenLocal) {
          const token = await cambiarClaveFirebase(usuario.email, actual, nueva);
          return respuesta.json({ token, usuario: servicioUsuarios.miPerfil(usuario) });
        }
        if (!usuario.passwordHash || !(await verificarContrasena(actual, usuario.passwordHash))) {
          throw new ErrorHttp(401, 'La contraseña temporal actual no es correcta.');
        }
        const hash = await hashearContrasena(nueva);
        const actualizado = await usuarios.findOneAndUpdate(
          { _id: usuario._id, passwordHash: usuario.passwordHash },
          {
            $inc: { sessionVersion: 1 },
            $set: {
              passwordHash: hash,
              localAuth: true,
              mustChangePassword: false,
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after' }
        );
        if (!actualizado) throw new ErrorHttp(409, 'Las credenciales cambiaron. Vuelve a iniciar sesión.');
        return respuesta.json({
          token: crearTokenLocal(actualizado._id, actualizado.sessionVersion ?? 0),
          usuario: servicioUsuarios.miPerfil(await resolverIdentidadSocial(baseDeDatos, actualizado)),
        });
      } catch (error) {
        return siguiente(error);
      }
    }
  );

  rutas.post(
    '/firebase/registro',
    autenticacion.autenticarToken,
    controladorUsuarios.registrar
  );

  return rutas;
}
