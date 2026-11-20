import type { IdentidadToken } from './autenticacion';
import type { Usuario } from '../modulos/usuarios/usuario.modelo';

declare global {
  namespace Express {
    interface Request {
      usuarioId?: string;
      usuario?: Usuario;
      identidad?: IdentidadToken;
    }
  }
}

export {};
