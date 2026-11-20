import { Db, ObjectId, WithId, UpdateFilter, ClientSession, Filter } from 'mongodb';
import { enTransaccion } from '../../infraestructura/base_datos/transacciones';
import { ErrorHttp } from '../../comun/errores';
import { salirDeSalaChat } from '../../infraestructura/tiempo-real/eventos';
import { Chat, InfoParticipante } from '../chats/chat.modelo';
import { Usuario } from '../usuarios/usuario.modelo';
import { ComunidadColeccion } from './colecciones';

export type ComunidadPersistida = WithId<ComunidadColeccion>;

export class ComunidadesRepositorio {
  constructor(private readonly baseDeDatos: Db) {}

  listarPara(usuarioId: string) {
    return this.baseDeDatos.collection<ComunidadColeccion>('communities')
      .find({ $or: [{ tipoAcceso: { $ne: 'INVITACION' } }, { miembros: usuarioId }, { creadorId: usuarioId }, { invitados: usuarioId }] })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
  }

  buscarSede(codigo: string) {
    return this.baseDeDatos.collection<{ _id: string; name: string; status: string }>('campuses')
      .findOne({ _id: codigo, status: { $ne: 'INACTIVE' } });
  }

  async crear(datos: Omit<ComunidadColeccion, '_id'>, conChat: boolean, creador: Usuario) {
    const id = new ObjectId();
    const comunidad = { ...datos, _id: id, chatIdAsociado: conChat ? id.toHexString() : null };
    return enTransaccion(this.baseDeDatos, async (session) => {
      if (conChat) await this.asegurarChat(comunidad, id, [creador], session);
      await this.baseDeDatos.collection<ComunidadColeccion>('communities').insertOne(comunidad, { session });
      return comunidad;
    });
  }

  buscarPorId(id: string): Promise<ComunidadPersistida | null> {
    if (!ObjectId.isValid(id)) return Promise.resolve(null);
    return this.baseDeDatos.collection<ComunidadColeccion>('communities').findOne({ _id: new ObjectId(id) });
  }

  async cambiarMembresia(id: ObjectId, usuarioId: string, accion: 'salir' | 'aceptar' | 'unir' | 'aprobar' | 'rechazar' | 'cancelar' | 'solicitar') {
    const salir = accion === 'salir';
    const ingresar = ['aceptar', 'unir', 'aprobar'].includes(accion);
    const filtro: Filter<ComunidadColeccion> = { _id: id };
    let cambio: UpdateFilter<ComunidadColeccion>;
    if (salir) {
      filtro.miembros = usuarioId;
      filtro.creadorId = { $ne: usuarioId };
      cambio = { $pull: { miembros: usuarioId } };
    } else if (ingresar) {
      if (accion === 'aceptar') filtro.invitados = usuarioId;
      if (accion === 'aprobar') filtro.solicitudes = usuarioId;
      cambio = { $addToSet: { miembros: usuarioId }, $pull: { solicitudes: usuarioId, invitados: usuarioId } };
    } else if (accion === 'solicitar') {
      filtro.miembros = { $ne: usuarioId };
      cambio = { $addToSet: { solicitudes: usuarioId } };
    } else {
      filtro.solicitudes = usuarioId;
      cambio = { $pull: { solicitudes: usuarioId } };
    }
    const comunidad = await enTransaccion(this.baseDeDatos, async (session) => {
      const comunidad = await this.baseDeDatos.collection<ComunidadColeccion>('communities').findOneAndUpdate(
        filtro, { ...cambio, $set: { updatedAt: new Date() } }, { session, returnDocument: 'after' }
      );
      if (!comunidad) throw new ErrorHttp(409, 'La membresía ya cambió. Actualiza la comunidad.');
      if (comunidad.chatIdAsociado && (ingresar || salir)) {
        const chatId = new ObjectId(comunidad.chatIdAsociado);
        const chats = this.baseDeDatos.collection<Chat>('chats');
        if (salir) {
          await chats.updateOne({ _id: chatId }, {
            $pull: { participantIds: usuarioId }, $unset: { [`participantsInfo.${usuarioId}`]: '', [`unreadCounts.${usuarioId}`]: '' },
          }, { session });
        } else {
          const cuenta = await this.baseDeDatos.collection<Usuario>('users').findOne({ _id: usuarioId, status: 'ACTIVE', role: 'USER' }, { session });
          if (!cuenta) throw new ErrorHttp(404, 'Cuenta no disponible.');
          await chats.updateOne({ _id: chatId, participantIds: { $ne: usuarioId } }, {
            $addToSet: { participantIds: usuarioId },
            $set: { [`participantsInfo.${usuarioId}`]: this.info(cuenta), [`unreadCounts.${usuarioId}`]: 0 },
          }, { session });
        }
      }
      return comunidad;
    });
    if (salir && comunidad.chatIdAsociado) salirDeSalaChat(usuarioId, comunidad.chatIdAsociado);
    return comunidad;
  }

  async listarSolicitantes(ids: string[]) {
    if (ids.length === 0) return [];
    return this.baseDeDatos.collection<Usuario>('users')
      .find({ _id: { $in: ids } })
      .project({ _id: 1, displayName: 1, username: 1 })
      .toArray();
  }

  usuarioActivoExiste(id: string) {
    return this.baseDeDatos.collection<Usuario>('users').findOne({ _id: id, status: 'ACTIVE', role: 'USER' }, { projection: { _id: 1 } });
  }

  invitar(id: ObjectId, usuarioId: string) {
    return this.baseDeDatos.collection<ComunidadColeccion>('communities').updateOne(
      { _id: id },
      { $addToSet: { invitados: usuarioId }, $pull: { solicitudes: usuarioId }, $set: { updatedAt: new Date() } }
    );
  }

  private info(usuario: Usuario): InfoParticipante {
    return { displayName: usuario.displayName, avatarUrl: usuario.avatarUrl ?? null, program: usuario.program };
  }

  private async asegurarChat(comunidad: ComunidadPersistida, id: ObjectId, integrantes: Usuario[], session?: ClientSession) {
    const chat = await this.baseDeDatos.collection<Chat>('chats').findOneAndUpdate(
      { _id: id }, { $setOnInsert: {
        type: 'GROUP', groupName: comunidad.nombre, comunidadId: comunidad._id.toHexString(),
        participantIds: integrantes.map((u) => u._id), participantsInfo: Object.fromEntries(integrantes.map((u) => [u._id, this.info(u)])),
        unreadCounts: Object.fromEntries(integrantes.map((u) => [u._id, 0])), createdBy: comunidad.creadorId, updatedAt: new Date(),
      } }, { session, upsert: true, returnDocument: 'after' }
    );
    if (!chat) throw new ErrorHttp(503, 'No se pudo abrir la conversación.');
    return chat;
  }

  async abrirChat(id: ObjectId, usuarioId: string) {
    return enTransaccion(this.baseDeDatos, async (session) => {
      const coleccion = this.baseDeDatos.collection<ComunidadColeccion>('communities');
      const comunidad = await coleccion.findOne({ _id: id, miembros: usuarioId }, { session });
      if (!comunidad) throw new ErrorHttp(403, 'Solo los miembros pueden abrir la conversación.');
      const chatId = comunidad.chatIdAsociado ? new ObjectId(comunidad.chatIdAsociado) : id;
      const existente = await this.baseDeDatos.collection<Chat>('chats').findOne({ _id: chatId }, { session });
      if (comunidad.chatIdAsociado && existente) return { chat: existente, creado: false };
      if (usuarioId !== comunidad.creadorId) throw new ErrorHttp(403, 'Solo quien creó la comunidad puede habilitar el chat.');
      const vinculada = await coleccion.findOneAndUpdate({ _id: id }, { $set: { chatIdAsociado: chatId.toString() } }, { returnDocument: 'after', session });
      const miembros = await this.baseDeDatos.collection<Usuario>('users').find({ _id: { $in: vinculada!.miembros }, status: 'ACTIVE', role: 'USER' }, { session }).toArray();
      const chat = await this.asegurarChat(comunidad, chatId, miembros, session);
      return { chat, creado: !existente };
    });
  }
}
