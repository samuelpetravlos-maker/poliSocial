export type RolUsuario = 'USER' | 'MODERATOR' | 'ADMIN';
export type TipoCuenta = 'STUDENT' | 'TEACHER' | 'PAGE';
export type Sede = 'URABA' | 'MEDELLIN' | 'RIONEGRO' | (string & {});
export type EstadoUsuario = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface PreferenciasNotificacion {
  push: boolean;
  follows: boolean;
  likes: boolean;
  comments: boolean;
  mentions: boolean;
}

export interface EnlacesPerfil {
  github?: string | null;
  linkedin?: string | null;
}

export interface TerminosAceptados {
  version: string;
  at: Date;
}

export interface Usuario {
  altaPaginaPendiente?: string;
  paginaId?: string;
  paginaDelegada?: boolean;
  _id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  campus: Sede;
  campusLabel?: string;
  faculty?: string | null;
  program: string;
  semester?: number | null;
  links?: EnlacesPerfil | null;
  role: RolUsuario;
  accountType: TipoCuenta;
  accountLabel?: string;
  accountProfileId?: string;
  passwordHash?: string;
  localAuth?: boolean;
  mustChangePassword?: boolean;
  sessionVersion?: number;
  banUntil?: Date | null;
  banReason?: string | null;
  banDetails?: string | null;
  isVerifiedPoli: boolean;
  followersCount: number;
  followingCount: number;
  fcmTokens?: string[];
  notificationPrefs?: PreferenciasNotificacion | null;
  status: EstadoUsuario;
  termsAcceptedAt: TerminosAceptados;
  createdAt: Date;
  updatedAt: Date;
}

export interface SnapshotAutor {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  campus: Sede;
  campusLabel?: string;
  program: string;
  isVerifiedPoli: boolean;
  accountType?: TipoCuenta;
  accountLabel?: string;
}

export interface ResumenAutor {
  uid: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  campus: Sede;
  campusLabel?: string;
  program: string;
  isVerifiedPoli: boolean;
  accountType?: TipoCuenta;
  accountLabel?: string;
}

export function crearSnapshotAutor(usuario: Usuario): SnapshotAutor {
  return {
    displayName: usuario.displayName,
    username: usuario.username,
    avatarUrl: usuario.avatarUrl ?? null,
    campus: usuario.campus,
    ...(usuario.campusLabel ? { campusLabel: usuario.campusLabel } : {}),
    program: usuario.program,
    isVerifiedPoli: usuario.isVerifiedPoli,
    accountType: usuario.accountType,
    ...(usuario.accountLabel ? { accountLabel: usuario.accountLabel } : {}),
  };
}

export function crearResumenAutor(usuario: Usuario): ResumenAutor {
  return {
    uid: usuario._id,
    displayName: usuario.displayName,
    username: usuario.username,
    avatarUrl: usuario.avatarUrl ?? null,
    campus: usuario.campus,
    ...(usuario.campusLabel ? { campusLabel: usuario.campusLabel } : {}),
    program: usuario.program,
    isVerifiedPoli: usuario.isVerifiedPoli,
    accountType: usuario.accountType,
    ...(usuario.accountLabel ? { accountLabel: usuario.accountLabel } : {}),
  };
}
