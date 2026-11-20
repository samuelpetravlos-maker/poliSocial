import { RolUsuario } from '../modulos/usuarios/usuario.modelo';

/** Acciones del producto que el servidor puede autorizar de forma explícita. */
export type CapacidadPoli =
  | 'leer_muro'
  | 'publicar_contenido'
  | 'reaccionar'
  | 'comentar'
  | 'reportar_contenido'
  | 'usar_mensajeria'
  | 'participar_comunidades'
  | 'gestionar_perfil_propio'
  | 'gestionar_contenido_propio'
  | 'gestionar_pagina_propia'
  | 'crear_pagina_institucional'
  | 'seguir_paginas'
  | 'gestionar_paginas'
  | 'revisar_reportes'
  | 'moderar_contenido'
  | 'consultar_cuentas'
  | 'gestionar_cuentas'
  | 'gestionar_roles'
  | 'verificar_paginas'
  | 'consultar_panel_administrativo'
  | 'consultar_auditoria'
  | 'gestionar_catalogos';

/**
 * Matriz base de permisos. Las reglas de propiedad y contexto (por ejemplo,
 * editar solo la propia página o proteger al administrador fundador) se
 * comprueban además en el servicio que conoce el recurso concreto.
 */
const CAPACIDADES_POR_ROL: Record<RolUsuario, ReadonlySet<CapacidadPoli>> = {
  USER: new Set([
    'leer_muro',
    'publicar_contenido',
    'gestionar_contenido_propio',
    'reaccionar',
    'comentar',
    'reportar_contenido',
    'usar_mensajeria',
    'participar_comunidades',
    'gestionar_perfil_propio',
    'gestionar_pagina_propia',
    'crear_pagina_institucional',
    'seguir_paginas',
  ]),
  MODERATOR: new Set([
    'leer_muro',
    'revisar_reportes',
    'moderar_contenido',
  ]),
  ADMIN: new Set([
    'leer_muro',
    'revisar_reportes',
    'moderar_contenido',
    'consultar_cuentas',
    'gestionar_cuentas',
    'gestionar_roles',
    'verificar_paginas',
    'consultar_panel_administrativo',
    'consultar_auditoria',
    'gestionar_catalogos',
    'crear_pagina_institucional',
    'gestionar_paginas',
  ]),
};

export function tieneCapacidad(rol: RolUsuario, capacidad: CapacidadPoli): boolean {
  return CAPACIDADES_POR_ROL[rol].has(capacidad);
}
