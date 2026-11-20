import { ObjectId } from 'mongodb';
import { Sede, SnapshotAutor } from '../usuarios/usuario.modelo';

export type CanalPublicacion = 'GENERAL' | 'ACADEMICO' | 'PROYECTOS' | 'AVISOS' | 'MERCADO';
export type EstadoPublicacion = 'VISIBLE' | 'HIDDEN_BY_MOD' | 'DELETED';
export type EstadoMercado = 'AVAILABLE' | 'SOLD';

export interface MercadoMeta {
  price: number;
  currency: 'COP';
  status: EstadoMercado;
}

export interface Publicacion {
  formato?: import('./formatos').FormatoPublicacion;
  opcionesEncuesta?: string[];
  ubicacion?: string | null;
  fechaEvento?: Date;
  _id?: ObjectId;
  authorId: string;
  pageId?: string | null;
  authorSnapshot: SnapshotAutor;
  campus: Sede;
  hubChannel: CanalPublicacion;
  title?: string | null;
  content: string;
  mediaUrls: string[];
  tags: string[];
  mentions: string[];
  marketMeta?: MercadoMeta | null;
  isResolved?: boolean | null;
  isPinned: boolean;
  likesCount: number;
  commentsCount: number;
  status: EstadoPublicacion;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reaccion {
  _id?: ObjectId;
  postId: ObjectId;
  userId: string;
  type?: 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED';
  createdAt: Date;
}

export interface Comentario {
  _id?: ObjectId;
  postId: ObjectId;
  authorId: string;
  authorSnapshot: SnapshotAutor;
  text: string;
  isAcceptedAnswer: boolean;
  status: EstadoPublicacion;
  createdAt: Date;
}

export const CANALES: readonly CanalPublicacion[] = [
  'GENERAL',
  'ACADEMICO',
  'PROYECTOS',
  'AVISOS',
  'MERCADO',
];
