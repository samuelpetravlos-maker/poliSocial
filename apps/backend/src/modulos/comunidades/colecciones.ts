import { ObjectId } from 'mongodb';

export interface ComunidadColeccion {
  _id?: ObjectId;
  nombre: string;
  descripcion: string;
  sede: string;
  nombreSede?: string;
  categoria: 'ACADEMICO' | 'SEMILLERO' | 'TECNOLOGIA' | 'EMPRENDIMIENTO' | 'DEPORTES' | 'CULTURA';
  tipoAcceso: 'LIBRE' | 'APROBACION' | 'INVITACION';
  miembros: string[];
  solicitudes: string[];
  invitados: string[];
  creadorId: string;
  creadorSnapshot: { displayName: string; username: string; avatarUrl: string | null };
  reglas: string[];
  chatIdAsociado: string | null;
  createdAt: Date;
  updatedAt: Date;
}
