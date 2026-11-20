import { ObjectId } from 'mongodb';

export type TipoChat = 'DIRECT' | 'GROUP';
export type TipoMensaje = 'TEXT' | 'IMAGE';

export interface InfoParticipante {
  displayName: string;
  avatarUrl: string | null;
  program: string;
}

export interface UltimoMensaje {
  text: string;
  senderId: string;
  senderName: string;
  mediaType: TipoMensaje;
  sentAt: Date;
}

export interface Chat {
  _id?: ObjectId;
  type: TipoChat;
  comunidadId?: string;
  directKey?: string | null;
  groupName?: string | null;
  groupAvatar?: string | null;
  participantIds: string[];
  participantsInfo: Record<string, InfoParticipante>;
  lastMessage?: UltimoMensaje | null;
  unreadCounts: Record<string, number>;
  createdBy: string;
  updatedAt: Date;
}

export interface Mensaje {
  _id?: ObjectId;
  chatId: ObjectId;
  senderId: string;
  senderName: string;
  text?: string | null;
  mediaUrl?: string | null;
  clientMsgId?: string | null;
  readBy: string[];
  createdAt: Date;
}
