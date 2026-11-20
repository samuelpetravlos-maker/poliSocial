import type { RolUsuario } from '@/servicios/api-cliente';

/** Permisos para mostrar funciones en la web; el backend sigue siendo la autoridad. */
export type PermisoInterfaz =
  | 'interactuar_socialmente'
  | 'moderar_muro'
  | 'usar_centro_administrativo'
  | 'ver_perfil_social';

const PERMISOS_POR_ROL: Record<RolUsuario, ReadonlySet<PermisoInterfaz>> = {
  USER: new Set(['interactuar_socialmente', 'ver_perfil_social']),
  MODERATOR: new Set(['moderar_muro']),
  ADMIN: new Set(['usar_centro_administrativo', 'moderar_muro']),
};

export function tienePermisoInterfaz(rol: RolUsuario | undefined, permiso: PermisoInterfaz): boolean {
  return rol ? PERMISOS_POR_ROL[rol].has(permiso) : false;
}
