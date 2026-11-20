import { ObjectId } from 'mongodb';
import { ErrorHttp } from '../../comun/errores';
import { Usuario } from '../usuarios/usuario.modelo';
import { Chat } from '../chats/chat.modelo';
import { ComunidadColeccion } from './colecciones';
import { ComunidadesRepositorio, ComunidadPersistida } from './repositorio';

const CATEGORIAS = ['ACADEMICO', 'SEMILLERO', 'TECNOLOGIA', 'EMPRENDIMIENTO', 'DEPORTES', 'CULTURA'] as const;
const ACCESOS = ['LIBRE', 'APROBACION', 'INVITACION'] as const;

function estaEnLista<T extends string>(valor: unknown, opciones: readonly T[]): valor is T {
  return typeof valor === 'string' && opciones.some((opcion) => opcion === valor);
}

function resumirComunidad(comunidad: ComunidadPersistida, usuarioId: string) {
  return {
    _id: comunidad._id,
    nombre: comunidad.nombre,
    descripcion: comunidad.descripcion,
    sede: comunidad.sede,
    nombreSede: comunidad.nombreSede,
    categoria: comunidad.categoria,
    tipoAcceso: comunidad.tipoAcceso,
    miembrosCount: comunidad.miembros.length,
    creadorId: comunidad.creadorId,
    creadorNombre: comunidad.creadorSnapshot.displayName,
    reglas: comunidad.reglas,
    chatIdAsociado: comunidad.chatIdAsociado,
    createdAt: comunidad.createdAt,
    updatedAt: comunidad.updatedAt,
    esMiembro: comunidad.miembros.includes(usuarioId),
    solicitudPendiente: comunidad.solicitudes.includes(usuarioId),
    invitacionPendiente: comunidad.invitados.includes(usuarioId),
    solicitudesCount: comunidad.creadorId === usuarioId ? comunidad.solicitudes.length : undefined,
    color: '#1b5e20',
    creadoEn: comunidad.createdAt.toISOString(),
  };
}

export class ComunidadesServicio {
  constructor(private readonly repositorio: ComunidadesRepositorio) {}

  async listar(usuario: Usuario) {
    const comunidades = await this.repositorio.listarPara(usuario._id);
    return { comunidades: comunidades.map((comunidad) => resumirComunidad(comunidad as ComunidadPersistida, usuario._id)) };
  }

  async crear(usuario: Usuario, entrada: Record<string, unknown>) {
    const nombre = typeof entrada.nombre === 'string' ? entrada.nombre.trim() : '';
    const descripcion = typeof entrada.descripcion === 'string' ? entrada.descripcion.trim() : '';
    if (nombre.length < 3 || nombre.length > 80) throw new ErrorHttp(400, 'El nombre debe tener entre 3 y 80 caracteres.');
    if (descripcion.length < 3 || descripcion.length > 300) throw new ErrorHttp(400, 'La descripción debe tener hasta 300 caracteres.');
    const sede = typeof entrada.sede === 'string' ? entrada.sede : '';
    const nombreSede = sede === 'GLOBAL' ? 'Todo el Poli' : (await this.repositorio.buscarSede(sede))?.name;
    if (!nombreSede || !estaEnLista(entrada.categoria, CATEGORIAS) || !estaEnLista(entrada.tipoAcceso, ACCESOS)) {
      throw new ErrorHttp(400, 'Sede, categoría o acceso no válidos.');
    }
    const reglas = Array.isArray(entrada.reglas)
      ? entrada.reglas.filter((valor): valor is string => typeof valor === 'string').map((valor) => valor.trim().slice(0, 200)).filter(Boolean).slice(0, 20)
      : [];
    const ahora = new Date();
    const comunidad: Omit<ComunidadColeccion, '_id'> = {
      nombre,
      descripcion,
      sede, nombreSede,
      categoria: entrada.categoria,
      tipoAcceso: entrada.tipoAcceso,
      miembros: [usuario._id],
      solicitudes: [],
      invitados: [],
      creadorId: usuario._id,
      creadorSnapshot: { displayName: usuario.displayName, username: usuario.username, avatarUrl: usuario.avatarUrl ?? null },
      reglas,
      chatIdAsociado: null,
      createdAt: ahora,
      updatedAt: ahora,
    };
    const creada = await this.repositorio.crear(comunidad, entrada.crearChatVinculado === true, usuario);
    return resumirComunidad(creada, usuario._id);
  }

  async alternarMembresia(usuario: Usuario, id: string) {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Comunidad no encontrada.');
    const comunidad = await this.repositorio.buscarPorId(id);
    if (!comunidad) throw new ErrorHttp(404, 'Comunidad no encontrada.');
    const idMongo = new ObjectId(id);

    if (comunidad.miembros.includes(usuario._id)) {
      if (comunidad.creadorId === usuario._id) throw new ErrorHttp(400, 'El creador no puede abandonar su comunidad.');
      await this.repositorio.cambiarMembresia(idMongo, usuario._id, 'salir');
    } else if (comunidad.invitados.includes(usuario._id)) {
      await this.repositorio.cambiarMembresia(idMongo, usuario._id, 'aceptar');
    } else if (comunidad.tipoAcceso === 'INVITACION') {
      throw new ErrorHttp(403, 'Necesitas una invitación para unirte a esta comunidad.');
    } else if (comunidad.tipoAcceso === 'APROBACION') {
      await this.repositorio.cambiarMembresia(idMongo, usuario._id, comunidad.solicitudes.includes(usuario._id) ? 'cancelar' : 'solicitar');
    } else {
      await this.repositorio.cambiarMembresia(idMongo, usuario._id, 'unir');
    }
    const actualizada = await this.repositorio.buscarPorId(id);
    if (!actualizada) throw new ErrorHttp(404, 'Comunidad no encontrada.');
    return resumirComunidad(actualizada, usuario._id);
  }

  async listarSolicitudes(usuario: Usuario, id: string) {
    const comunidad = await this.obtenerComunidad(id);
    if (comunidad.creadorId !== usuario._id) throw new ErrorHttp(403, 'Solo quien creó la comunidad puede revisar estas solicitudes.');
    return { usuarios: await this.repositorio.listarSolicitantes(comunidad.solicitudes) };
  }

  async resolverSolicitud(usuario: Usuario, id: string, usuarioSolicitanteId: string, aprobar: unknown) {
    const comunidad = await this.obtenerComunidad(id);
    if (comunidad.creadorId !== usuario._id) throw new ErrorHttp(403, 'Solo quien creó la comunidad puede aprobar solicitudes.');
    if (typeof aprobar !== 'boolean' || !comunidad.solicitudes.includes(usuarioSolicitanteId)) {
      throw new ErrorHttp(404, 'Solicitud pendiente no encontrada.');
    }
    if (aprobar && !(await this.repositorio.usuarioActivoExiste(usuarioSolicitanteId))) throw new ErrorHttp(404, 'Cuenta no disponible.');
    await this.repositorio.cambiarMembresia(comunidad._id, usuarioSolicitanteId, aprobar ? 'aprobar' : 'rechazar');
    return { resuelta: true, aprobada: aprobar };
  }

  async invitar(usuario: Usuario, id: string, usuarioInvitadoId: unknown) {
    const comunidad = await this.obtenerComunidad(id);
    if (comunidad.creadorId !== usuario._id) {
      throw new ErrorHttp(403, 'Solo quien creó la comunidad puede invitar personas.');
    }
    if (typeof usuarioInvitadoId !== 'string' || !usuarioInvitadoId || usuarioInvitadoId === usuario._id || comunidad.miembros.includes(usuarioInvitadoId)) {
      throw new ErrorHttp(400, 'Selecciona una persona válida para invitar.');
    }
    if (!(await this.repositorio.usuarioActivoExiste(usuarioInvitadoId))) throw new ErrorHttp(404, 'La cuenta invitada no está disponible.');
    await this.repositorio.invitar(comunidad._id, usuarioInvitadoId);
    return { invitado: true };
  }

  async crearChat(usuario: Usuario, id: string): Promise<{ chat: Chat; creado: boolean }> {
    const comunidad = await this.obtenerComunidad(id);
    return this.repositorio.abrirChat(comunidad._id, usuario._id);
  }

  private async obtenerComunidad(id: string): Promise<ComunidadPersistida> {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Comunidad no encontrada.');
    const comunidad = await this.repositorio.buscarPorId(id);
    if (!comunidad) throw new ErrorHttp(404, 'Comunidad no encontrada.');
    return comunidad;
  }
}
