import { PaginasRepositorio } from '../paginas/paginas.repositorio';
import { Request, RequestHandler } from 'express';
import { Collection, Db } from 'mongodb';
import { hashearContrasena, validarNuevaContrasena } from '../../comun/credenciales';
import { ErrorHttp } from '../../comun/errores';
import { Usuario, RolUsuario, Sede, TipoCuenta } from '../usuarios/usuario.modelo';
import { desconectarUsuario } from '../../infraestructura/tiempo-real/eventos';
import { CapacidadPoli, tieneCapacidad } from '../../comun/permisos';

const ROLES: readonly RolUsuario[] = ['USER', 'MODERATOR', 'ADMIN'];
const TIPOS_CUENTA: readonly TipoCuenta[] = ['STUDENT', 'TEACHER', 'PAGE'];
const MOTIVOS_BANEO = ['SPAM', 'ACOSO', 'CONTENIDO_INAPROPIADO', 'FRAUDE', 'INCUMPLIMIENTO', 'OTRO'] as const;
// La cuenta semilla local_admin es la fundadora y conserva la gestión de otros administradores.
const ADMIN_FUNDADOR_ID = process.env.ADMIN_FUNDADOR_ID ?? 'local_admin';

function actor(solicitud: Request): Usuario {
  if (!solicitud.usuario) throw new ErrorHttp(401, 'Falta el token de autenticación.');
  return solicitud.usuario;
}

function exigirCapacidad(capacidad: CapacidadPoli) {
  return (solicitud: Request) => {
    if (!tieneCapacidad(actor(solicitud).role, capacidad)) {
      throw new ErrorHttp(403, 'No tienes permisos para realizar esta acción.');
    }
  };
}

function perfilSeguro(usuario: Usuario) {
  const { passwordHash: _passwordHash, ...seguro } = usuario;
  return seguro;
}

async function registrarAuditoria(
  baseDeDatos: Db,
  administrador: Usuario,
  accion: string,
  tipoObjetivo: string,
  objetivoId: string,
  detalles?: Record<string, unknown>
) {
  await baseDeDatos.collection('auditLogs').insertOne({
    actorId: administrador._id,
    actorRole: administrador.role,
    action: accion,
    targetType: tipoObjetivo,
    targetId: objetivoId,
    details: detalles ?? null,
    createdAt: new Date(),
  });
}

export class ControladorCuentas {
  private readonly usuarios: Collection<Usuario>;
  constructor(private readonly baseDeDatos: Db) {
    this.usuarios = baseDeDatos.collection<Usuario>('users');
  }

  crearCuenta: RequestHandler = async (solicitud, respuesta, siguiente) => {
    try {
      const admin = actor(solicitud);
      const datos = solicitud.body ?? {};
      const altaPagina = datos.accountType === 'PAGE' && datos.role === 'USER' && !datos.tipoPerfilId;
      if (!(altaPagina && admin.role === 'MODERATOR')) exigirCapacidad('gestionar_cuentas')(solicitud);
      const username = typeof datos.username === 'string' ? datos.username.trim().toLowerCase() : '';
      const email = typeof datos.email === 'string' ? datos.email.trim().toLowerCase() : '';
      const displayName = typeof datos.displayName === 'string' ? datos.displayName.trim() : '';
      const rol = datos.role as RolUsuario;
      const tipoPerfilId = typeof datos.tipoPerfilId === 'string' ? datos.tipoPerfilId : undefined;
      const perfilConfigurado = tipoPerfilId ? await this.baseDeDatos.collection('accountTypes').findOne({ _id: tipoPerfilId, status: 'ACTIVE' }) : null;
      const tipoCuenta = (perfilConfigurado?.baseType ?? datos.accountType) as TipoCuenta;
      const accountLabel = typeof perfilConfigurado?.name === 'string' ? perfilConfigurado.name : undefined;
      const sede = datos.campus as Sede;
      const programaElegido = typeof datos.programId === 'string'
        ? await this.baseDeDatos.collection<{ _id: string; name?: string; campuses?: string[]; faculty?: string }>('programs').findOne({ _id: datos.programId, status: { $ne: 'INACTIVE' } })
        : null;
      const sedeConfigurada = await this.baseDeDatos.collection<{ _id: string; name?: string }>('campuses').findOne({ _id: sede, status: { $ne: 'INACTIVE' } });
      const program = tipoCuenta === 'PAGE' ? 'Cuenta institucional' : typeof programaElegido?.name === 'string' ? programaElegido.name : '';

      if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
        throw new ErrorHttp(400, 'El usuario admite minúsculas, números, puntos y guiones bajos (3 a 30 caracteres).');
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new ErrorHttp(400, 'Ingresa un correo válido.');
      }
      if (displayName.length < (tipoCuenta === 'PAGE' ? 3 : 2) || displayName.length > 80) {
        throw new ErrorHttp(400, `El nombre debe tener entre ${tipoCuenta === 'PAGE' ? 3 : 2} y 80 caracteres.`);
      }
      if (!ROLES.includes(rol) || !TIPOS_CUENTA.includes(tipoCuenta) || !sedeConfigurada) {
        throw new ErrorHttp(400, 'Selecciona un rol, tipo de cuenta y sede válidos.');
      }
      if (tipoPerfilId && !perfilConfigurado) throw new ErrorHttp(400, 'El perfil elegido está inhabilitado o no existe.');
      if (tipoCuenta !== 'PAGE' && (!programaElegido || !Array.isArray(programaElegido.campuses) || !programaElegido.campuses.includes(sede))) {
        throw new ErrorHttp(400, 'Selecciona una carrera activa disponible en la sede elegida.');
      }
      if (rol === 'ADMIN' && admin._id !== ADMIN_FUNDADOR_ID) {
        throw new ErrorHttp(403, 'Solo el administrador fundador puede crear otros administradores.');
      }
      if (tipoCuenta === 'PAGE' && rol !== 'USER') {
        throw new ErrorHttp(400, 'Las páginas institucionales deben usar el rol de acceso USER.');
      }
      const nombreNormalizadoPagina = displayName.toLocaleLowerCase('es');
      const usuarioId = `local_${username}`;
      if (tipoCuenta === 'PAGE' && await this.baseDeDatos.collection('pages').findOne({ nombreNormalizado: nombreNormalizadoPagina, propietarioId: { $ne: usuarioId } })) {
        throw new ErrorHttp(409, 'Ya existe una página con ese nombre. Elige otro nombre para la cuenta institucional.');
      }
      const existente = await this.usuarios.findOne({ $or: [{ username }, { email }] });
      const continuarAlta = tipoCuenta === 'PAGE' && existente?.altaPaginaPendiente === admin._id &&
        existente.username === username && existente.email === email && existente.displayName === displayName;
      if (existente && !continuarAlta) {
        throw new ErrorHttp(409, 'El usuario o correo ya está registrado.');
      }

      const ahora = new Date();
      const claveInicial = datos.password === undefined ? username : validarNuevaContrasena(datos.password);
      const categoria = typeof datos.categoria === 'string' ? datos.categoria.trim() : 'Institucional';
      if (tipoCuenta === 'PAGE' && !await new PaginasRepositorio(this.baseDeDatos).categoriaActiva(categoria, true)) {
        throw new ErrorHttp(400, 'Selecciona una categoría activa.');
      }
      if (tipoCuenta === 'PAGE' && datos.verificada === true && admin.role !== 'ADMIN') throw new ErrorHttp(403, 'Solo administración puede verificar páginas.');
      const verificada = datos.verificada === true && tipoCuenta === 'PAGE' && tieneCapacidad(admin.role, 'verificar_paginas');
      const usuario: Usuario = {
        _id: usuarioId,
        email,
        emailVerified: false,
        username,
        displayName,
        avatarUrl: null,
        bio: null,
        campus: sede,
        campusLabel: typeof sedeConfigurada.name === 'string' ? sedeConfigurada.name : sede,
        faculty: typeof programaElegido?.faculty === 'string' ? programaElegido.faculty : null,
        program,
        semester: null,
        role: rol,
        accountType: tipoCuenta,
        ...(accountLabel ? { accountLabel } : {}),
        ...(tipoPerfilId ? { accountProfileId: tipoPerfilId } : {}),
        sessionVersion: 0,
        passwordHash: await hashearContrasena(claveInicial),
        localAuth: true,
        mustChangePassword: datos.password === undefined,
        isVerifiedPoli: verificada,
        followersCount: 0,
        followingCount: 0,
        fcmTokens: [],
        notificationPrefs: { push: true, follows: true, likes: true, comments: true, mentions: true },
        status: 'ACTIVE',
        termsAcceptedAt: { version: '1.0', at: ahora },
        createdAt: ahora,
        updatedAt: ahora,
      };
      if (tipoCuenta === 'PAGE') {
        if (!continuarAlta) await this.usuarios.insertOne({ ...usuario, status: 'SUSPENDED', altaPaginaPendiente: admin._id });
        const pages = this.baseDeDatos.collection('pages');
        const pagina = await pages.findOneAndUpdate(
          { nombreNormalizado: nombreNormalizadoPagina, propietarioId: usuarioId },
          { $setOnInsert: {
            nombre: displayName,
            nombreNormalizado: nombreNormalizadoPagina,
            descripcion: `Página institucional de ${displayName}`,
            categoria,
            propietarioId: usuarioId,
            propietarioRol: admin.role,
            propietarioSnapshot: { username, displayName, avatarUrl: null },
            avatarUrl: null,
            portadaUrl: null,
            seguidores: 0,
            isVerified: verificada,
            verificationStatus: verificada ? 'VERIFIED' : 'UNREQUESTED',
            verifiedBy: verificada ? admin._id : null,
            verifiedAt: verificada ? ahora : null,
            createdAt: ahora,
          } },
          { upsert: true, returnDocument: 'after' },
        );
        usuario.paginaId = pagina!._id.toString();
        await this.usuarios.updateOne({ _id: usuarioId, altaPaginaPendiente: admin._id }, {
          $set: { status: 'ACTIVE', paginaId: usuario.paginaId, passwordHash: usuario.passwordHash, mustChangePassword: usuario.mustChangePassword },
          $unset: { altaPaginaPendiente: '' },
        });
      } else {
        await this.usuarios.insertOne(usuario);
      }
      await registrarAuditoria(this.baseDeDatos, admin, 'CREATE_USER', 'USER', usuarioId, {
        role: rol,
        accountType: tipoCuenta,
      });
      return respuesta.status(201).json({
        usuario: perfilSeguro(usuario),
        claveTemporal: claveInicial,
        mensaje: usuario.mustChangePassword ? 'La contraseña temporal es igual al usuario. Debe cambiarla al iniciar sesión.' : 'Cuenta creada con la contraseña indicada.',
      });
    } catch (error) {
      return siguiente(error);
    }
  };

  cambiarPerfil: RequestHandler = async (solicitud, respuesta, siguiente) => {
    try {
      exigirCapacidad('gestionar_cuentas')(solicitud);
      const administrador = actor(solicitud);
      const id = solicitud.params.id;
      const perfilId = typeof solicitud.body?.perfilId === 'string' ? solicitud.body.perfilId : '';
      const perfil = await this.baseDeDatos.collection('accountTypes').findOne({ _id: perfilId, status: 'ACTIVE' });
      if (!perfil || !['STUDENT', 'TEACHER'].includes(String(perfil.baseType))) throw new ErrorHttp(400, 'Selecciona un perfil activo de estudiante o profesor.');
      const objetivo = await this.usuarios.findOne({ _id: id, status: { $ne: 'DELETED' } });
      if (!objetivo) throw new ErrorHttp(404, 'Cuenta activa no encontrada.');
      if (objetivo.accountType === 'PAGE') throw new ErrorHttp(400, 'El tipo de perfil de las páginas se administra desde la pestaña Páginas.');
      const tipoAnterior = objetivo.accountLabel ?? objetivo.accountType;
      await this.usuarios.updateOne({ _id: id }, { $set: { accountType: perfil.baseType as TipoCuenta, accountLabel: perfil.name, accountProfileId: perfilId, updatedAt: new Date() } });
      await registrarAuditoria(this.baseDeDatos, administrador, 'CHANGE_ROLE', 'USER', id, { tipo: 'perfil', from: tipoAnterior, to: perfil.name });
      return respuesta.json({ perfil: perfil.name, accountType: perfil.baseType });
    } catch (error) { return siguiente(error); }
  };

  aplicarBaneo: RequestHandler = async (solicitud, respuesta, siguiente) => {
    try {
      exigirCapacidad('moderar_contenido')(solicitud);
      const admin = actor(solicitud);
      const id = solicitud.params.id;
      if (id === admin._id) throw new ErrorHttp(400, 'No puedes banear tu propia cuenta.');
      const objetivo = await this.usuarios.findOne({ _id: id });
      if (!objetivo || objetivo.status !== 'ACTIVE') throw new ErrorHttp(404, 'Usuario activo no encontrado.');
      if (admin.role === 'MODERATOR' && objetivo.role !== 'USER') {
        throw new ErrorHttp(403, 'Los moderadores solo pueden banear cuentas de usuario.');
      }
      if (admin.role === 'ADMIN' && objetivo.role === 'ADMIN' && admin._id !== ADMIN_FUNDADOR_ID) {
        throw new ErrorHttp(403, 'Solo el administrador fundador puede moderar cuentas ADMIN.');
      }
      const motivo = solicitud.body?.reason;
      if (!MOTIVOS_BANEO.includes(motivo)) {
        throw new ErrorHttp(400, `El motivo debe ser uno de: ${MOTIVOS_BANEO.join(', ')}.`);
      }
      const dias = solicitud.body?.days === undefined ? 30 : Number(solicitud.body.days);
      if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
        throw new ErrorHttp(400, 'La duración debe ser de 1 a 365 días.');
      }
      const details = typeof solicitud.body?.details === 'string' ? solicitud.body.details.trim().slice(0, 500) : '';
      const banUntil = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
      await this.usuarios.updateOne({ _id: id }, { $inc: { sessionVersion: 1 }, $set: { banUntil, banReason: motivo, banDetails: details || null, updatedAt: new Date() } });
      desconectarUsuario(id);
      await registrarAuditoria(this.baseDeDatos, admin, 'BAN_USER', 'USER', id, { reason: motivo, details, days: dias, banUntil });
      return respuesta.json({ baneado: true, banUntil, reason: motivo });
    } catch (error) {
      return siguiente(error);
    }
  };

  retirarBaneo: RequestHandler = async (solicitud, respuesta, siguiente) => {
    try {
      exigirCapacidad('moderar_contenido')(solicitud);
      const admin = actor(solicitud);
      const id = solicitud.params.id;
      if (id === admin._id) throw new ErrorHttp(400, 'No puedes quitar el baneo a tu propia cuenta.');
      const objetivo = await this.usuarios.findOne({ _id: id });
      if (!objetivo) throw new ErrorHttp(404, 'Usuario no encontrado.');
      if (admin.role === 'MODERATOR' && objetivo.role !== 'USER') {
        throw new ErrorHttp(403, 'Los moderadores solo pueden moderar cuentas de usuario.');
      }
      if (admin.role === 'ADMIN' && objetivo.role === 'ADMIN' && admin._id !== ADMIN_FUNDADOR_ID) {
        throw new ErrorHttp(403, 'Solo el administrador fundador puede modificar cuentas ADMIN.');
      }
      await this.usuarios.updateOne({ _id: id }, { $inc: { sessionVersion: 1 }, $unset: { banUntil: '', banReason: '', banDetails: '' }, $set: { updatedAt: new Date() } });
      await registrarAuditoria(this.baseDeDatos, admin, 'UNBAN_USER', 'USER', id);
      return respuesta.json({ baneado: false });
    } catch (error) {
      return siguiente(error);
    }
  };

  restablecerContrasena: RequestHandler = async (solicitud, respuesta, siguiente) => {
    try {
      exigirCapacidad('gestionar_cuentas')(solicitud);
      const admin = actor(solicitud);
      const id = solicitud.params.id;
      const objetivo = await this.usuarios.findOne({ _id: id });
      if (!objetivo || objetivo.status === 'DELETED') throw new ErrorHttp(404, 'Usuario activo no encontrado.');
      if (objetivo.paginaDelegada) throw new ErrorHttp(400, 'Esta página utiliza el acceso de su titular.');
      if (objetivo.role === 'ADMIN' && admin._id !== ADMIN_FUNDADOR_ID && admin._id !== id) throw new ErrorHttp(403, 'Solo el fundador puede recuperar otra cuenta de administración.');
      const claveTemporal = objetivo.username;
      await this.usuarios.updateOne(
        { _id: id },
        {
          $inc: { sessionVersion: 1 },
          $set: {
            passwordHash: await hashearContrasena(claveTemporal),
            localAuth: true,
            mustChangePassword: true,
            updatedAt: new Date(),
          },
        }
      );
      desconectarUsuario(id);
      await registrarAuditoria(this.baseDeDatos, admin, 'RESET_PASSWORD', 'USER', id);
      return respuesta.json({ claveTemporal, mensaje: 'La contraseña temporal coincide con el usuario y debe cambiarse al iniciar sesión.' });
    } catch (error) {
      return siguiente(error);
    }
  };

  cambiarRol: RequestHandler = async (solicitud, respuesta, siguiente) => {
    try {
      exigirCapacidad('gestionar_roles')(solicitud);
      const admin = actor(solicitud);
      const id = solicitud.params.id;
      const nuevoRol = solicitud.body?.role as RolUsuario;
      const objetivo = await this.usuarios.findOne({ _id: id });
      if (!objetivo || objetivo.status === 'DELETED') throw new ErrorHttp(404, 'Usuario activo no encontrado.');
      if (id === admin._id) throw new ErrorHttp(400, 'No puedes cambiar tu propio rol.');
      if (!ROLES.includes(nuevoRol)) throw new ErrorHttp(400, 'El rol debe ser USER, MODERATOR o ADMIN.');
      if (nuevoRol === 'ADMIN' && admin._id !== ADMIN_FUNDADOR_ID) {
        throw new ErrorHttp(403, 'Solo el administrador fundador puede crear otros administradores.');
      }
      if (objetivo.role === 'ADMIN' && admin._id !== ADMIN_FUNDADOR_ID) {
        throw new ErrorHttp(403, 'Solo el administrador fundador puede cambiar el rol de otra cuenta ADMIN.');
      }
      if (objetivo.accountType === 'PAGE' && nuevoRol !== 'USER') throw new ErrorHttp(400, 'Una página institucional debe conservar el rol USER.');
      if (objetivo.role === 'ADMIN' && nuevoRol !== 'ADMIN') {
        const adminsActivos = await this.usuarios.countDocuments({ role: 'ADMIN', status: 'ACTIVE' });
        if (adminsActivos <= 1) throw new ErrorHttp(400, 'Debe permanecer al menos un administrador activo.');
      }
      await this.usuarios.updateOne({ _id: id }, { $inc: { sessionVersion: 1 }, $set: { role: nuevoRol, updatedAt: new Date() } });
      await registrarAuditoria(this.baseDeDatos, admin, 'CHANGE_ROLE', 'USER', id, { from: objetivo.role, to: nuevoRol });
      return respuesta.json({ usuario: perfilSeguro({ ...objetivo, role: nuevoRol }) });
    } catch (error) {
      return siguiente(error);
    }
  };

  cambiarEstado: RequestHandler = async (solicitud, respuesta, siguiente) => {
    try {
      exigirCapacidad('gestionar_cuentas')(solicitud);
      const admin = actor(solicitud);
      const id = solicitud.params.id;
      const activo = solicitud.body?.activo;
      if (typeof activo !== 'boolean') throw new ErrorHttp(400, 'Indica si la cuenta debe quedar habilitada.');
      if (id === admin._id) throw new ErrorHttp(400, 'No puedes inhabilitar tu propia cuenta.');
      const objetivo = await this.usuarios.findOne({ _id: id });
      if (!objetivo) throw new ErrorHttp(404, 'Cuenta no encontrada.');
      if ((objetivo.status === 'ACTIVE' && activo) || (objetivo.status === 'DELETED' && !activo)) return respuesta.json({ activo });
      if (objetivo.role === 'ADMIN') {
        if (admin._id !== ADMIN_FUNDADOR_ID) {
          throw new ErrorHttp(403, 'Solo el administrador fundador puede cambiar el estado de otras cuentas ADMIN.');
        }
        if (!activo) {
          const adminsActivos = await this.usuarios.countDocuments({ role: 'ADMIN', status: 'ACTIVE' });
          if (adminsActivos <= 1) throw new ErrorHttp(400, 'Debe permanecer al menos un administrador activo.');
        }
      }
      await this.usuarios.updateOne({ _id: id }, { $inc: { sessionVersion: 1 }, $set: { status: activo ? 'ACTIVE' : 'DELETED', updatedAt: new Date() } });
      if (!activo) desconectarUsuario(id);
      await registrarAuditoria(this.baseDeDatos, admin, 'DELETE_USER', 'USER', id, { activo });
      return respuesta.json({ activo });
    } catch (error) {
      return siguiente(error);
    }
  };
}
