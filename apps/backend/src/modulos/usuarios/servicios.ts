import { IdentidadToken } from '../../comun/autenticacion';
import { ErrorHttp } from '../../comun/errores';
import { CursorFechaId } from '../../comun/paginacion';
import {
  arregloDeTextos,
  booleano,
  enteroEnRango,
  esCorreoValido,
  textoOpcional,
  textoRequerido,
} from '../../comun/validacion';
import { emitirNotificacion } from '../../infraestructura/tiempo-real/eventos';
import { NotificacionesRepositorio } from '../notificaciones/notificaciones.repositorio';
import { Seguimiento } from './bloqueo.modelo';
import { BloqueosRepositorio } from './bloqueos.repositorio';
import { PaginaSeguimientos, SeguidoresRepositorio } from './seguidores.repositorio';
import {
  EnlacesPerfil,
  PreferenciasNotificacion,
  RolUsuario,
  Sede,
  TipoCuenta,
  Usuario,
  crearResumenAutor,
  crearSnapshotAutor,
} from './usuario.modelo';
import { UsuariosRepositorio } from './usuarios.repositorio';

const TIPOS_CUENTA_REGISTRO: readonly TipoCuenta[] = ['STUDENT', 'TEACHER'];

export interface DatosRegistro {
  email?: string;
  username?: unknown;
  displayName?: unknown;
  campus?: unknown;
  program?: unknown;
  faculty?: unknown;
  semester?: unknown;
  accountType?: unknown;
  tipoPerfilId?: unknown;
  emailVerified?: unknown;
  avatarUrl?: unknown;
  bio?: unknown;
  enlaces?: unknown;
  aceptaTerminos?: unknown;
  versionTerminos?: unknown;
}

export interface DatosPerfil {
  displayName?: unknown;
  bio?: unknown;
  avatarUrl?: unknown;
  semester?: unknown;
  links?: unknown;
  notificationPrefs?: unknown;
  fcmTokens?: unknown;
}

export class UsuariosServicio {
  constructor(
    private readonly repositorio: UsuariosRepositorio,
    private readonly seguidores: SeguidoresRepositorio,
    private readonly bloqueos: BloqueosRepositorio,
    private readonly notificaciones: NotificacionesRepositorio
  ) {}

  async registrar(
    identidad: IdentidadToken,
    datos: DatosRegistro,
    passwordHash?: string
  ): Promise<Usuario> {
    const email = (identidad.email ?? textoRequerido(datos.email, 'email', { max: 160 })).toLowerCase();
    if (!esCorreoValido(email)) {
      throw new ErrorHttp(400, 'El correo electrónico no tiene un formato válido.');
    }

    const username = textoRequerido(datos.username, 'username', { min: 3, max: 30 }).toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
      throw new ErrorHttp(
        400,
        'El nombre de usuario solo admite minúsculas, números, puntos y guiones bajos (3 a 30 caracteres).'
      );
    }

    if (await this.repositorio.buscarPorEmail(email)) {
      throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo electrónico.');
    }
    if (await this.repositorio.buscarPorUsername(username)) {
      throw new ErrorHttp(409, 'El nombre de usuario ya está en uso.');
    }

    if (datos.aceptaTerminos !== true) {
      throw new ErrorHttp(
        400,
        'Debes aceptar las normas de convivencia y la política de tratamiento de datos.'
      );
    }

    const tipoPerfilId = typeof datos.tipoPerfilId === 'string' ? datos.tipoPerfilId : String(datos.accountType ?? 'STUDENT');
    const tipoCuentaSolicitado = datos.accountType === undefined ? 'STUDENT' : String(datos.accountType);
    if (!TIPOS_CUENTA_REGISTRO.includes(tipoCuentaSolicitado as TipoCuenta)) throw new ErrorHttp(400, 'El tipo de cuenta seleccionado no está habilitado para registro.');
    const campus = textoRequerido(datos.campus, 'campus', { max: 60 });
    const programa = textoRequerido(datos.program, 'program', { max: 120 });
    const institucion = await this.repositorio.validarDatosInstitucionales(campus, programa, tipoPerfilId, tipoCuentaSolicitado);
    if (!institucion.sedeValida) throw new ErrorHttp(400, 'La sede seleccionada está inhabilitada o no existe.');
    if (!institucion.programa) throw new ErrorHttp(400, 'La carrera seleccionada está inhabilitada o no corresponde a la sede.');
    if (!institucion.perfil || institucion.perfil.baseType !== tipoCuentaSolicitado) throw new ErrorHttp(400, 'El perfil seleccionado está inhabilitado o no coincide con el tipo de cuenta.');

    const emailVerified =
      identidad.emailVerificado ??
      (identidad.modoDesarrollo ? booleano(datos.emailVerified, 'emailVerified', false) : false);

    const ahora = new Date();
    const usuario: Usuario = {
      _id: identidad.usuarioId,
      email,
      emailVerified,
      username,
      displayName: textoRequerido(datos.displayName, 'displayName', { min: 2, max: 80 }),
      avatarUrl: textoOpcional(datos.avatarUrl, 'avatarUrl', { max: 500 }),
      bio: textoOpcional(datos.bio, 'bio', { max: 200 }),
      campus: campus as Sede,
      campusLabel: typeof institucion.sedeValida.name === 'string' ? institucion.sedeValida.name : campus,
      faculty: textoOpcional(datos.faculty, 'faculty', { max: 120 }),
      program: programa,
      semester:
        datos.semester === undefined || datos.semester === null
          ? null
          : enteroEnRango(datos.semester, 'semester', 1, Number(institucion.programa.semesters ?? 10)),
      links: this.normalizarEnlaces(datos.enlaces),
      role: 'USER',
      accountType: tipoCuentaSolicitado as TipoCuenta,
      ...(typeof institucion.perfil.name === 'string' && institucion.perfil.name !== tipoCuentaSolicitado ? { accountLabel: institucion.perfil.name } : {}),
      accountProfileId: tipoPerfilId,
      ...(passwordHash ? { passwordHash, localAuth: true, mustChangePassword: false } : {}),
      isVerifiedPoli: emailVerified && email.endsWith('@elpoli.edu.co'),
      followersCount: 0,
      followingCount: 0,
      fcmTokens: [],
      notificationPrefs: {
        push: true,
        follows: true,
        likes: true,
        comments: true,
        mentions: true,
      },
      status: 'ACTIVE',
      termsAcceptedAt: {
        version:
          typeof datos.versionTerminos === 'string' && datos.versionTerminos.length > 0
            ? datos.versionTerminos
            : '1.0',
        at: ahora,
      },
      createdAt: ahora,
      updatedAt: ahora,
    };

    return this.repositorio.crear(usuario);
  }

  async obtenerPerfil(id: string) {
    const usuario = await this.repositorio.buscarPorIdentificador(id);
    return usuario?.role === 'USER' && usuario.status === 'ACTIVE' ? this.perfilPublico(usuario) : null;
  }

  miPerfil(usuario: Usuario) {
    return {
      ...usuario,
      passwordHash: undefined,
      fcmTokens: undefined,
      notificationPrefs: usuario.notificationPrefs ?? null,
    };
  }

  async buscar(filtros: { busqueda?: string; campus?: Sede; program?: string; limite: number }) {
    const usuarios = await this.repositorio.buscar(filtros);
    return usuarios.map((usuario) => this.perfilPublico(usuario));
  }

  async actualizarPerfil(usuario: Usuario, datos: DatosPerfil): Promise<Usuario | null> {
    const cambios: Partial<Usuario> = {};

    if (datos.displayName !== undefined) {
      cambios.displayName = textoRequerido(datos.displayName, 'displayName', { min: usuario.accountType === 'PAGE' ? 3 : 2, max: 80 });
    }
    if (datos.bio !== undefined) {
      cambios.bio = textoOpcional(datos.bio, 'bio', { max: 200 });
    }
    if (datos.avatarUrl !== undefined) {
      cambios.avatarUrl = textoOpcional(datos.avatarUrl, 'avatarUrl', { max: 500 });
    }
    if (datos.semester !== undefined) {
      cambios.semester =
        datos.semester === null ? null : enteroEnRango(datos.semester, 'semester', 1, await this.repositorio.limiteSemestres(usuario));
    }
    if (datos.links !== undefined) {
      cambios.links = this.normalizarEnlaces(datos.links);
    }
    if (datos.notificationPrefs !== undefined) {
      cambios.notificationPrefs = this.normalizarPreferencias(datos.notificationPrefs);
    }
    if (datos.fcmTokens !== undefined) {
      cambios.fcmTokens = arregloDeTextos(datos.fcmTokens, 'fcmTokens', 10, 400);
    }

    if (Object.keys(cambios).length === 0) {
      throw new ErrorHttp(400, 'No se recibieron cambios para actualizar el perfil.');
    }

    await this.repositorio.actualizarDatosDePagina(usuario, cambios);
    const actualizado = await this.repositorio.actualizar(usuario._id, cambios);
    if (!actualizado) {
      throw new ErrorHttp(404, 'Usuario no encontrado.');
    }

    await this.repositorio.propagarSnapshot(actualizado);
    return actualizado;
  }

  async seguir(usuario: Usuario, objetivoId: string) {
    if (usuario._id === objetivoId) {
      throw new ErrorHttp(400, 'No puedes seguirte a ti mismo.');
    }

    const objetivo = await this.repositorio.buscarPorIdentificador(objetivoId);
    if (!objetivo || objetivo.status !== 'ACTIVE') {
      throw new ErrorHttp(404, 'El usuario que intentas seguir no existe o no está activo.');
    }
    if (await this.bloqueos.existeBloqueo(usuario._id, objetivoId)) {
      throw new ErrorHttp(403, 'No puedes seguir a un usuario con el que tienes un bloqueo.');
    }

    const creado = await this.seguidores.seguir(usuario._id, objetivoId);

    if (creado && objetivo.notificationPrefs?.follows !== false) {
      const notificacion = await this.notificaciones.crear({
        userId: objetivoId,
        type: 'NEW_FOLLOWER',
        actorSnapshot: {
          uid: usuario._id,
          displayName: usuario.displayName,
          avatarUrl: usuario.avatarUrl ?? null,
        },
        refType: 'USER',
        refId: usuario._id,
      });
      emitirNotificacion(objetivoId, notificacion);
    }

    return { siguiendo: true, yaExistia: !creado };
  }

  async dejarDeSeguir(usuario: Usuario, objetivoId: string) {
    if (usuario._id === objetivoId) {
      throw new ErrorHttp(400, 'No puedes dejar de seguirte a ti mismo.');
    }
    const eliminado = await this.seguidores.dejarDeSeguir(usuario._id, objetivoId);
    return { siguiendo: false, eliminado };
  }

  async listarSeguidores(usuarioId: string, limite: number, cursor?: CursorFechaId | null) {
    const pagina = await this.seguidores.listarSeguidores(usuarioId, limite, cursor);
    return this.resolverSeguimientos(pagina, (seguimiento) => seguimiento.followerId);
  }

  async listarSeguidos(usuarioId: string, limite: number, cursor?: CursorFechaId | null) {
    const pagina = await this.seguidores.listarSeguidos(usuarioId, limite, cursor);
    return this.resolverSeguimientos(pagina, (seguimiento) => seguimiento.followingId);
  }

  sugerencias(usuario: Usuario, limite = 5) {
    return this.repositorio
      .sugerencias(usuario, limite)
      .then((usuarios) => usuarios.map((sugerido) => this.perfilPublico(sugerido)));
  }

  async bloquear(usuario: Usuario, objetivoId: string) {
    if (usuario._id === objetivoId) {
      throw new ErrorHttp(400, 'No puedes bloquearte a ti mismo.');
    }
    const objetivo = await this.repositorio.buscarPorIdentificador(objetivoId);
    if (!objetivo) throw new ErrorHttp(404, 'El usuario no existe.');

    const creado = await this.bloqueos.bloquear(usuario._id, objetivoId);
    return { bloqueado: true, yaExistia: !creado };
  }

  async desbloquear(usuario: Usuario, objetivoId: string) {
    const eliminado = await this.bloqueos.desbloquear(usuario._id, objetivoId);
    return { bloqueado: false, eliminado };
  }

  private async resolverSeguimientos(
    pagina: PaginaSeguimientos,
    obtenerId: (seguimiento: Seguimiento) => string
  ) {
    const ids = pagina.seguimientos.map((seguimiento) => obtenerId(seguimiento));
    const usuarios = await this.repositorio.listarPorIds(ids);
    const porId = new Map(usuarios.map((usuario) => [usuario._id, usuario]));

    return {
      usuarios: ids
        .map((id) => porId.get(id))
        .filter((usuario): usuario is Usuario => usuario !== undefined)
        .map((usuario) => this.perfilPublico(usuario)),
      siguienteCursor: pagina.siguienteCursor,
    };
  }

  private perfilPublico(usuario: Usuario) {
    return {
      _id: usuario._id,
      ...crearResumenAutor(usuario),
      bio: usuario.bio ?? null,
      faculty: usuario.faculty ?? null,
      semester: usuario.semester ?? null,
      links: usuario.links ?? null,
      role: usuario.role,
      accountType: usuario.accountType,
      accountLabel: usuario.accountLabel,
      followersCount: usuario.followersCount,
      followingCount: usuario.followingCount,
      createdAt: usuario.createdAt,
      snapshot: crearSnapshotAutor(usuario),
    };
  }

  private normalizarEnlaces(valor: unknown): EnlacesPerfil | null {
    if (valor === undefined || valor === null) return null;
    if (typeof valor !== 'object' || Array.isArray(valor)) {
      throw new ErrorHttp(400, 'El campo links debe ser un objeto.');
    }
    const enlaces = valor as Record<string, unknown>;
    return {
      github: textoOpcional(enlaces.github, 'links.github', { max: 300 }),
      linkedin: textoOpcional(enlaces.linkedin, 'links.linkedin', { max: 300 }),
    };
  }

  private normalizarPreferencias(valor: unknown): PreferenciasNotificacion {
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      throw new ErrorHttp(400, 'El campo notificationPrefs debe ser un objeto.');
    }
    const preferencias = valor as Record<string, unknown>;
    return {
      push: booleano(preferencias.push, 'notificationPrefs.push', true),
      follows: booleano(preferencias.follows, 'notificationPrefs.follows', true),
      likes: booleano(preferencias.likes, 'notificationPrefs.likes', true),
      comments: booleano(preferencias.comments, 'notificationPrefs.comments', true),
      mentions: booleano(preferencias.mentions, 'notificationPrefs.mentions', true),
    };
  }
}
