import { ObjectId } from 'mongodb';
import { RolUsuario } from '../usuarios/usuario.modelo';

export interface PaginaColeccion {
  _id?: ObjectId;
  nombre: string;
  nombreNormalizado: string;
  descripcion: string;
  categoria: string;
  propietarioId: string;
  propietarioRol: RolUsuario;
  propietarioSnapshot: { username: string; displayName: string; avatarUrl: string | null };
  avatarUrl: string | null;
  portadaUrl: string | null;
  seguidores: number;
  isVerified: boolean;
  verificationStatus: 'UNREQUESTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  solicitudVerificacion?: Date;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
}
