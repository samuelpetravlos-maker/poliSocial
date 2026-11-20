import { ObjectId } from 'mongodb';

export type TipoNotificacion =
  | 'NEW_FOLLOWER'
  | 'LIKE'
  | 'COMMENT'
  | 'MENTION'
  | 'ANSWER_ACCEPTED'
  | 'CONTENT_REPORTED' | 'PAGE_VERIFICATION' | 'PAGE_DECISION' | 'CHAT_MESSAGE';

export interface ActorNotificacion {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Notificacion {
  _id?: ObjectId;
  userId: string;
  type: TipoNotificacion;
  actorSnapshot: ActorNotificacion;
  refType?: 'POST' | 'COMMENT' | 'USER' | 'REPORT' | 'PAGE' | 'CHAT' | null;
  refId?: string | null;
  summary?: string;
  isRead: boolean;
  createdAt: Date;
}
