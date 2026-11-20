import { Collection, Db, Filter, ObjectId } from 'mongodb';
import { esConflictoDuplicado } from '../../comun/errores';
import { codificarCursor, CursorFechaId } from '../../comun/paginacion';
import { enTransaccion } from '../../infraestructura/base_datos/transacciones';
import { Chat, InfoParticipante, Mensaje, UltimoMensaje } from './chat.modelo';

export interface PaginaMensajes {
  mensajes: Mensaje[];
  siguienteCursor: string | null;
}

export class ChatsRepositorio {
  private readonly chats: Collection<Chat>;
  private readonly mensajes: Collection<Mensaje>;

  constructor(private readonly baseDeDatos: Db) {
    this.chats = baseDeDatos.collection<Chat>('chats');
    this.mensajes = baseDeDatos.collection<Mensaje>('messages');
  }

  buscarPorId(id: string): Promise<Chat | null> {
    if (!ObjectId.isValid(id)) return Promise.resolve(null);
    return this.chats.findOne({ _id: new ObjectId(id) });
  }

  listarPorParticipante(usuarioId: string): Promise<Chat[]> {
    return this.chats
      .find({ participantIds: usuarioId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
  }

  async crearDirecto(
    directKey: string,
    participantIds: string[],
    participantsInfo: Record<string, InfoParticipante>,
    createdBy: string
  ): Promise<Chat> {
    const existente = await this.chats.findOne({ directKey });
    if (existente) return existente;

    const unreadCounts: Record<string, number> = {};
    participantIds.forEach((id) => {
      unreadCounts[id] = 0;
    });

    try {
      const creado = await this.chats.findOneAndUpdate(
        { directKey },
        {
          $setOnInsert: {
            type: 'DIRECT',
            directKey,
            groupName: null,
            groupAvatar: null,
            participantIds,
            participantsInfo,
            lastMessage: null,
            unreadCounts,
            createdBy,
            updatedAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      return creado as Chat;
    } catch (error) {
      if (esConflictoDuplicado(error)) {
        const chat = await this.chats.findOne({ directKey });
        if (chat) return chat;
      }
      throw error;
    }
  }

  async crearGrupo(
    groupName: string,
    groupAvatar: string | null,
    participantIds: string[],
    participantsInfo: Record<string, InfoParticipante>,
    createdBy: string
  ): Promise<Chat> {
    const unreadCounts: Record<string, number> = {};
    participantIds.forEach((id) => {
      unreadCounts[id] = 0;
    });

    const chat: Chat = {
      type: 'GROUP',
      directKey: null,
      groupName,
      groupAvatar,
      participantIds,
      participantsInfo,
      lastMessage: null,
      unreadCounts,
      createdBy,
      updatedAt: new Date(),
    };

    const resultado = await this.chats.insertOne(chat);
    return { ...chat, _id: resultado.insertedId };
  }

  esParticipante(chat: Chat, usuarioId: string): boolean {
    return chat.participantIds.includes(usuarioId);
  }

  async listarMensajes(
    chatId: ObjectId,
    limite: number,
    cursor?: CursorFechaId | null
  ): Promise<PaginaMensajes> {
    const consulta: Filter<Mensaje> = { chatId };
    if (cursor && ObjectId.isValid(cursor.id)) {
      const idCursor = new ObjectId(cursor.id);
      consulta.$or = [
        { createdAt: { $lt: cursor.fecha } },
        { createdAt: cursor.fecha, _id: { $lt: idCursor } },
      ];
    }

    const documentos = await this.mensajes
      .find(consulta)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limite + 1)
      .toArray();

    const hayMas = documentos.length > limite;
    const mensajes = hayMas ? documentos.slice(0, limite) : documentos;
    const ultimo = mensajes[mensajes.length - 1];

    return {
      mensajes,
      siguienteCursor:
        hayMas && ultimo?._id
          ? codificarCursor(ultimo.createdAt, ultimo._id.toString())
          : null,
    };
  }

  async crearMensaje(
    chat: Chat,
    senderId: string,
    senderName: string,
    text: string | null,
    mediaUrl: string | null,
    clientMsgId: string | null
  ): Promise<Mensaje> {
    if (!chat._id) {
      throw new Error('El chat no tiene identificador.');
    }

    if (clientMsgId) {
      const existente = await this.mensajes.findOne({ chatId: chat._id, clientMsgId });
      if (existente) return existente;
    }

    const ahora = new Date();
    const mensaje: Mensaje = {
      chatId: chat._id,
      senderId,
      senderName,
      text,
      mediaUrl,
      clientMsgId,
      readBy: [senderId],
      createdAt: ahora,
    };

    const ultimoMensaje: UltimoMensaje = {
      text: text ?? 'Archivo adjunto',
      senderId,
      senderName,
      mediaType: mediaUrl ? 'IMAGE' : 'TEXT',
      sentAt: ahora,
    };

    const incrementos: Record<string, number> = {};
    chat.participantIds
      .filter((id) => id !== senderId)
      .forEach((id) => {
        incrementos[`unreadCounts.${id}`] = 1;
      });

    try {
      let creado: Mensaje | null = null;
      await enTransaccion(this.baseDeDatos, async (sesion) => {
        const resultado = await this.mensajes.insertOne(mensaje, { session: sesion });
        await this.chats.updateOne(
          { _id: chat._id },
          {
            $set: { lastMessage: ultimoMensaje, updatedAt: ahora },
            ...(Object.keys(incrementos).length > 0 ? { $inc: incrementos } : {}),
          },
          { session: sesion }
        );
        const avisos = chat.participantIds.filter(id => id !== senderId).map(userId => ({
          userId, type: 'CHAT_MESSAGE', refType: 'CHAT', refId: chat._id!.toString(),
          actorSnapshot: { uid: senderId, displayName: senderName, avatarUrl: null },
          summary: 'envió un mensaje' + (chat.groupName ? ' en ' + chat.groupName : ''),
          createdAt: ahora, isRead: false,
        }));
        if (avisos.length) await this.baseDeDatos.collection('notifications').insertMany(avisos, { session: sesion });
        creado = { ...mensaje, _id: resultado.insertedId };
      });
      return creado as unknown as Mensaje;
    } catch (error) {
      if (esConflictoDuplicado(error) && clientMsgId) {
        const existente = await this.mensajes.findOne({ chatId: chat._id, clientMsgId });
        if (existente) return existente;
      }
      throw error;
    }
  }

  async adjuntoPropio(chatId: string, url: string, autor: string) {
    const id = url.split('/').pop();
    if (!id || !ObjectId.isValid(id) || url !== '/chats/' + chatId + '/adjuntos/' + id) return false;
    return !!await this.baseDeDatos.collection('adjuntosChat.files').findOne({
      _id: new ObjectId(id), 'metadata.chatId': chatId, 'metadata.autor': autor,
    }, { projection: { _id: 1 } });
  }

  async marcarLeido(chatId: ObjectId, usuarioId: string): Promise<void> {
    await this.chats.updateOne(
      { _id: chatId, participantIds: usuarioId },
      { $set: { [`unreadCounts.${usuarioId}`]: 0 } }
    );
    await this.mensajes.updateMany(
      { chatId, readBy: { $ne: usuarioId } },
      { $addToSet: { readBy: usuarioId } }
    );
  }
}
