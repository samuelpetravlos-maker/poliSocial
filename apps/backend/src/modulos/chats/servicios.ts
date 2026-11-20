import { ErrorHttp } from '../../comun/errores';
import { CursorFechaId } from '../../comun/paginacion';
import {
  arregloDeIdentificadores,
  textoOpcional,
  textoRequerido,
} from '../../comun/validacion';
import { emitirMensajeNuevo } from '../../infraestructura/tiempo-real/eventos';
import { BloqueosRepositorio } from '../usuarios/bloqueos.repositorio';
import { Usuario } from '../usuarios/usuario.modelo';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { Chat, InfoParticipante } from './chat.modelo';
import { ChatsRepositorio } from './chats.repositorio';

export interface DatosGrupo {
  groupName?: unknown;
  groupAvatar?: unknown;
  participantIds?: unknown;
}

export interface DatosMensaje {
  text?: unknown;
  mediaUrl?: unknown;
  clientMsgId?: unknown;
}

export class ChatsServicio {
  constructor(
    private readonly repositorio: ChatsRepositorio,
    private readonly usuarios: UsuariosRepositorio,
    private readonly bloqueos: BloqueosRepositorio
  ) {}

  async crearDirecto(usuario: Usuario, otroId: string): Promise<Chat> {
    if (usuario._id === otroId) {
      throw new ErrorHttp(400, 'No puedes iniciar un chat contigo mismo.');
    }

    const otro = await this.usuarios.buscarPorIdentificador(otroId);
    if (!otro || otro.role !== 'USER' || otro.status !== 'ACTIVE') {
      throw new ErrorHttp(404, 'El usuario no existe o no está activo.');
    }
    if (await this.bloqueos.existeBloqueo(usuario._id, otroId)) {
      throw new ErrorHttp(403, 'No puedes iniciar un chat con un usuario bloqueado.');
    }

    const participantIds = [usuario._id, otroId].sort();
    const participantsInfo: Record<string, InfoParticipante> = {
      [usuario._id]: this.infoParticipante(usuario),
      [otroId]: this.infoParticipante(otro),
    };

    return this.repositorio.crearDirecto(
      participantIds.join('_'),
      participantIds,
      participantsInfo,
      usuario._id
    );
  }

  async crearGrupo(usuario: Usuario, datos: DatosGrupo): Promise<Chat> {
    const groupName = textoRequerido(datos.groupName, 'groupName', { min: 2, max: 80 });
    const groupAvatar = textoOpcional(datos.groupAvatar, 'groupAvatar', { max: 500 });
    const participantIds = arregloDeIdentificadores(datos.participantIds, 'participantIds', 99);

    const idsUnicos = [...new Set([usuario._id, ...participantIds])];
    if (idsUnicos.length < 3) {
      throw new ErrorHttp(400, 'Un grupo de estudio requiere al menos dos integrantes además del creador.');
    }

    const integrantes = await this.usuarios.listarPorIds(idsUnicos);
    if (integrantes.length !== idsUnicos.length) {
      throw new ErrorHttp(400, 'Uno o más integrantes del grupo no existen.');
    }
    if (integrantes.some((integrante) => integrante.status !== 'ACTIVE' || integrante.role !== 'USER')) {
      throw new ErrorHttp(400, 'Uno o más integrantes del grupo no están activos.');
    }

    const participantsInfo: Record<string, InfoParticipante> = {};
    integrantes.forEach((integrante) => {
      participantsInfo[integrante._id] = this.infoParticipante(integrante);
    });

    return this.repositorio.crearGrupo(
      groupName,
      groupAvatar,
      idsUnicos,
      participantsInfo,
      usuario._id
    );
  }

  async listar(usuario: Usuario) {
    const chats = await this.repositorio.listarPorParticipante(usuario._id);
    const noLeidosTotales = chats.reduce(
      (total, chat) => total + (chat.unreadCounts[usuario._id] ?? 0),
      0
    );
    return { chats, noLeidosTotales };
  }

  async listarMensajes(
    usuario: Usuario,
    chatId: string,
    limite: number,
    cursor?: CursorFechaId | null
  ) {
    const chat = await this.obtenerChatAutorizado(usuario, chatId);
    const pagina = await this.repositorio.listarMensajes(chat._id!, limite, cursor);
    return { chat, ...pagina };
  }

  async enviarMensaje(usuario: Usuario, chatId: string, datos: DatosMensaje) {
    const chat = await this.obtenerChatAutorizado(usuario, chatId);

    if (chat.type === 'DIRECT') {
      const otro = chat.participantIds.find((id) => id !== usuario._id);
      if (otro && (await this.bloqueos.existeBloqueo(usuario._id, otro))) {
        throw new ErrorHttp(403, 'No puedes enviar mensajes a un usuario bloqueado.');
      }
    }

    const text =
      datos.text === undefined || datos.text === null
        ? null
        : textoRequerido(datos.text, 'text', { max: 5000 });
    const mediaUrl = textoOpcional(datos.mediaUrl, 'mediaUrl', { max: 1000 });
    if (mediaUrl && !(await this.repositorio.adjuntoPropio(chatId, mediaUrl, usuario._id))) {
      throw new ErrorHttp(400, 'Adjunta un archivo a esta conversación.');
    }
    const clientMsgId = textoOpcional(datos.clientMsgId, 'clientMsgId', { max: 100 });

    if (!text && !mediaUrl) {
      throw new ErrorHttp(400, 'El mensaje debe incluir texto o una imagen.');
    }

    const mensaje = await this.repositorio.crearMensaje(
      chat,
      usuario._id,
      usuario.displayName,
      text,
      mediaUrl,
      clientMsgId
    );

    emitirMensajeNuevo(chat._id!.toString(), chat.participantIds, mensaje);
    return mensaje;
  }

  async marcarLeido(usuario: Usuario, chatId: string) {
    const chat = await this.obtenerChatAutorizado(usuario, chatId);
    await this.repositorio.marcarLeido(chat._id!, usuario._id);
    return { leido: true };
  }

  private async obtenerChatAutorizado(usuario: Usuario, chatId: string): Promise<Chat> {
    const chat = await this.repositorio.buscarPorId(chatId);
    if (!chat) throw new ErrorHttp(404, 'Chat no encontrado.');
    if (!this.repositorio.esParticipante(chat, usuario._id)) {
      throw new ErrorHttp(403, 'No perteneces a esta conversación.');
    }
    return chat;
  }

  private infoParticipante(usuario: Usuario): InfoParticipante {
    return {
      displayName: usuario.displayName,
      avatarUrl: usuario.avatarUrl ?? null,
      program: usuario.program,
    };
  }
}
