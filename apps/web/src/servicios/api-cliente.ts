/**
 * Cliente API y catálogo institucional de Poli Social Network.
 * Gestiona la comunicación entre Next.js y el backend Node.js / MongoDB.
 */

export type Sede = 'URABA' | 'MEDELLIN' | 'RIONEGRO' | (string & {});
export type RolUsuario = 'USER' | 'MODERATOR' | 'ADMIN';
export type TipoCuenta = 'STUDENT' | 'TEACHER' | 'PAGE';

export interface SedeInfo {
  codigo: Sede;
  nombre: string;
  ciudad: string;
}

export interface ProgramaInfo {
  id: string;
  nombre: string;
  facultad: string;
  sedes: Sede[];
  semestres: number;
}

export const SEDES_CATALOGO: Record<string, SedeInfo> = {
  URABA: { codigo: 'URABA', nombre: 'Centro Regional Urabá', ciudad: 'Apartadó' },
  MEDELLIN: { codigo: 'MEDELLIN', nombre: 'Sede Central Medellín', ciudad: 'Medellín' },
  RIONEGRO: { codigo: 'RIONEGRO', nombre: 'Centro Regional Oriente', ciudad: 'Rionegro' },
};

export const PROGRAMAS_CATALOGO: ProgramaInfo[] = [
  {
    id: '6910',
    nombre: 'Tecnólogo en Desarrollo de Software',
    facultad: 'Facultad de Ingeniería',
    sedes: ['MEDELLIN', 'URABA', 'RIONEGRO'],
    semestres: 6,
  },
  {
    id: '6901',
    nombre: 'Tecnología en Sistemas',
    facultad: 'Facultad de Ingeniería',
    sedes: ['MEDELLIN', 'URABA'],
    semestres: 6,
  },
  {
    id: '1010',
    nombre: 'Ingeniería Informática',
    facultad: 'Facultad de Ingeniería',
    sedes: ['MEDELLIN', 'RIONEGRO'],
    semestres: 10,
  },
  {
    id: '2101',
    nombre: 'Tecnología en Gestión Ambiental',
    facultad: 'Facultad de Recursos Naturales',
    sedes: ['MEDELLIN', 'URABA', 'RIONEGRO'],
    semestres: 6,
  },
];

export interface Usuario {
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
  links?: {
    github?: string | null;
    linkedin?: string | null;
  } | null;
  role: RolUsuario;
  accountType: TipoCuenta;
  accountLabel?: string;
  accountProfileId?: string;
  mustChangePassword?: boolean;
  banUntil?: string | null;
  banReason?: string | null;
  isVerifiedPoli: boolean;
  followersCount: number;
  followingCount: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface DatosRegistro {
  email: string;
  username: string;
  displayName: string;
  campus: Sede;
  program: string;
  faculty?: string;
  semester?: number | null;
  accountType?: 'STUDENT' | 'TEACHER';
  tipoPerfilId?: string;
  aceptaTerminos: boolean;
  versionTerminos?: string;
  bio?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

export class ErrorApi extends Error {
  public readonly mensaje: string;

  constructor(
    public estado: number,
    mensaje: string,
    public detalles?: unknown
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.mensaje = mensaje;
  }
}

export function obtenerApiUrl(): string {
  if (typeof window !== 'undefined' && (window as unknown as { __POLIHUB_API__?: string }).__POLIHUB_API__) {
    return (window as unknown as { __POLIHUB_API__?: string }).__POLIHUB_API__!;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
}

export const CLAVES_ALMACENAMIENTO = {
  TOKEN: 'polihub_token',
  USUARIO: 'polihub_usuario',
} as const;

export interface RespuestaSesion {
  token: string;
  usuario: Usuario;
}

export interface UsuarioAdministracion extends Usuario {
  banDetails?: string | null;
  localAuth?: boolean;
}

export interface CrearCuentaAdministrada {
  categoria?: string;
  verificada?: boolean;
  password?: string;
  username: string;
  email: string;
  displayName: string;
  campus: Sede;
  program?: string;
  accountType: TipoCuenta;
  tipoPerfilId?: string;
  programId?: string;
  role: RolUsuario;
}

export type TipoCatalogoAdministrativo = 'sede' | 'programa' | 'perfil' | 'categoria_pagina';
export interface ElementoCatalogoAdministrativo {
  soloPersonal?: boolean;
  id: string;
  nombre: string;
  tipo: TipoCatalogoAdministrativo;
  activo: boolean;
  ciudad?: string;
  facultad?: string;
  sedes?: string[];
  semestres?: number;
  tipoBase?: TipoCuenta;
  integrado?: boolean;
}

export async function iniciarSesionLocalApi(identificador: string, password: string) {
  return clienteHttp<RespuestaSesion>('/autenticacion/sesion', {
    method: 'POST',
    body: JSON.stringify({ identificador, password }),
  });
}

export async function registrarCuentaLocalApi(datos: DatosRegistro, password: string) {
  return clienteHttp<RespuestaSesion>('/autenticacion/registro', {
    method: 'POST',
    body: JSON.stringify({ ...datos, password }),
  });
}

export async function cambiarContrasenaApi(
  passwordActual: string,
  passwordNueva: string,
  token: string
) {
  return clienteHttp<{ token: string; usuario: Usuario }>('/autenticacion/mi-contrasena', {
    method: 'PATCH',
    body: JSON.stringify({ passwordActual, passwordNueva }),
  }, token);
}

export interface PaginaSocial { solicitudVerificacion?: string; _id: string; nombre: string; descripcion: string; categoria: string; propietarioId: string; seguidores: number; avatarUrl?: string | null; portadaUrl?: string | null; isVerified: boolean; verificationStatus: 'UNREQUESTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'; siguiendo?: boolean; }
export async function listarPaginasApi(token: string) {
  return clienteHttp<{ paginas: PaginaSocial[] }>('/paginas', {}, token);
}
export function entrarPaginaApi(id: string, token: string) {
  return clienteHttp<{ token: string }>(`/paginas/${encodeURIComponent(id)}/identidad`, { method: 'POST' }, token);
}
export async function crearPaginaApi(datos: { nombre: string; descripcion: string; categoria: string }, token: string) {
  return clienteHttp<{ pagina: PaginaSocial }>('/paginas', { method: 'POST', body: JSON.stringify(datos) }, token);
}
export async function verificarPaginaApi(id: string, verificada: boolean, token: string, solicitud?: string) {
  return clienteHttp<{ pagina: PaginaSocial }>(`/paginas/${encodeURIComponent(id)}/verificacion`, { method: 'PATCH', body: JSON.stringify({ verificada, solicitud }) }, token);
}
export function solicitarVerificacionApi(id: string, token: string) {
  return clienteHttp<{ pagina: PaginaSocial }>(`/paginas/${encodeURIComponent(id)}/solicitud-verificacion`, { method: 'POST' }, token);
}
export function cambiarAccesoCategoria(id: string, soloPersonal: boolean, token: string) {
  return clienteHttp(`/administracion/catalogos/categoria_pagina/${encodeURIComponent(id)}/acceso`, { method: 'PATCH', body: JSON.stringify({ soloPersonal }) }, token);
}
export async function actualizarPaginaApi(id: string, datos: Partial<Pick<PaginaSocial, 'nombre' | 'descripcion' | 'categoria' | 'avatarUrl' | 'portadaUrl'>>, token: string) {
  return clienteHttp<{ pagina: PaginaSocial }>(`/paginas/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(datos) }, token);
}
export async function seguirPaginaApi(id: string, siguiendo: boolean, token: string) {
  return clienteHttp<{ siguiendo: boolean; seguidores: number }>(`/paginas/${encodeURIComponent(id)}/seguir`, { method: siguiendo ? 'POST' : 'DELETE' }, token);
}
export async function listarComunidadesApi(token: string) {
  return clienteHttp<{ comunidades: Array<Record<string, unknown>> }>('/comunidades', {}, token);
}
export async function crearComunidadApi(datos: { nombre: string; descripcion: string; sede: string; categoria: string; tipoAcceso: string; reglas: string[] }, token: string) {
  return clienteHttp<Record<string, unknown>>('/comunidades', { method: 'POST', body: JSON.stringify(datos) }, token);
}
export async function alternarMembresiaApi(id: string, token: string) {
  return clienteHttp<Record<string, unknown>>(`/comunidades/${encodeURIComponent(id)}/membresia`, { method: 'POST' }, token);
}
export async function listarSolicitudesComunidadApi(id: string, token: string) {
  return clienteHttp<{ usuarios: Usuario[] }>(`/comunidades/${encodeURIComponent(id)}/solicitudes`, {}, token);
}
export async function resolverSolicitudComunidadApi(id: string, usuarioId: string, aprobar: boolean, token: string) {
  return clienteHttp<{ resuelta: boolean; aprobada: boolean }>(`/comunidades/${encodeURIComponent(id)}/solicitudes/${encodeURIComponent(usuarioId)}`, { method: 'PATCH', body: JSON.stringify({ aprobar }) }, token);
}
export async function crearChatComunidadApi(id: string, token: string) {
  return clienteHttp<{ chat: ChatApi }>(`/comunidades/${encodeURIComponent(id)}/chat`, { method: 'POST' }, token);
}
export async function listarUsuariosApi(token: string) {
  return clienteHttp<{ usuarios: Usuario[] }>('/usuarios?limite=50', {}, token);
}
export async function listarSeguidosApi(id: string, token: string) {
  return clienteHttp<{ usuarios: Usuario[] }>(`/usuarios/${encodeURIComponent(id)}/seguidos?limite=50`, {}, token);
}
export async function seguirUsuarioApi(id: string, siguiendo: boolean, token: string) {
  return clienteHttp<{ siguiendo: boolean }>(`/usuarios/${encodeURIComponent(id)}/seguir`, { method: siguiendo ? 'POST' : 'DELETE' }, token);
}
export interface ChatApi {
  _id: string; type: 'DIRECT' | 'GROUP'; groupName?: string | null; participantIds: string[];
  participantsInfo: Record<string, { displayName: string; avatarUrl: string | null; program: string }>;
  lastMessage?: { text: string; senderId: string; sentAt: string } | null;
  unreadCounts: Record<string, number>;
}
export async function listarChatsApi(token: string) {
  return clienteHttp<{ chats: ChatApi[]; noLeidosTotales: number }>('/chats', {}, token);
}
export async function listarMensajesChatApi(id: string, token: string) {
  return clienteHttp<{ mensajes: Array<Record<string, unknown>> }>(`/chats/${encodeURIComponent(id)}/mensajes`, {}, token);
}
export async function crearChatDirectoApi(usuarioId: string, token: string) {
  return clienteHttp<ChatApi>('/chats/directos', { method: 'POST', body: JSON.stringify({ usuarioId }) }, token);
}
export async function enviarMensajeChatApi(id: string, text: string, token: string, mediaUrl?: string) {
  return clienteHttp<Record<string, unknown>>(`/chats/${encodeURIComponent(id)}/mensajes`, { method: 'POST', body: JSON.stringify({ text: text || null, mediaUrl, clientMsgId: crypto.randomUUID() }) }, token);
}
export async function marcarChatLeidoApi(id: string, token: string) {
  return clienteHttp<{ leido: boolean }>(`/chats/${encodeURIComponent(id)}/leido`, { method: 'POST' }, token);
}
export async function crearChatGrupoApi(nombre: string, participantIds: string[], token: string) {
  return clienteHttp<ChatApi>('/chats/grupos', { method: 'POST', body: JSON.stringify({ groupName: nombre, participantIds }) }, token);
}
export interface ReporteModeracion { _id: string; reporterName: string; targetType: string; targetId: string; reason: string; details?: string; status: string; createdAt: string; }
export interface NotificacionApi { _id: string; userId: string; type: string; actorSnapshot: { uid: string; displayName: string; avatarUrl: string | null }; refType?: string | null; refId?: string | null; summary?: string; isRead: boolean; createdAt: string; }
export async function listarNotificacionesApi(token: string) {
  return clienteHttp<{ notificaciones: NotificacionApi[]; noLeidas: number }>('/notificaciones?limite=30', {}, token);
}
export async function marcarNotificacionLeidaApi(id: string, token: string) {
  return clienteHttp<{ leida: boolean }>(`/notificaciones/${encodeURIComponent(id)}/leido`, { method: 'POST' }, token);
}
export async function crearReporteApi(datos: { targetType: string; targetId: string; reason: string; details?: string }, token: string) {
  return clienteHttp<{ duplicado?: boolean }>('/moderacion/reportes', { method: 'POST', body: JSON.stringify(datos) }, token);
}
export async function listarReportesModeracionApi(token: string) {
  return clienteHttp<{ reportes: ReporteModeracion[] }>('/moderacion/reportes', {}, token);
}
export async function resolverReporteModeracionApi(id: string, status: 'REVIEWING' | 'RESOLVED' | 'DISMISSED', accion: 'OCULTAR' | 'ELIMINAR' | 'BANEAR' | 'NINGUNA', token: string) {
  return clienteHttp<{ reporte: ReporteModeracion }>(`/moderacion/reportes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, accion }) }, token);
}
export async function ejecutarAccionModeracionApi(datos: { targetType: 'POST' | 'USER'; targetId: string; accion: 'OCULTAR' | 'BANEAR'; reason?: string; details?: string }, token: string) {
  return clienteHttp<{ aplicada: boolean; duracionDias: number | null }>('/moderacion/acciones', { method: 'POST', body: JSON.stringify(datos) }, token);
}
export async function subirArchivoApi(archivo: File, token: string) {
  if (archivo.size > 64 * 1024 * 1024) throw new Error('El archivo supera los 64 MB.');
  return clienteHttp<{ url: string; nombreOriginal: string; mime: string; tamano: number }>('/archivos', {
    method: 'POST', headers: { 'Content-Type': archivo.type || 'application/octet-stream', 'X-Nombre-Archivo': encodeURIComponent(archivo.name) }, body: archivo,
  }, token);
}
export async function crearPublicacionApi(datos: { hubChannel: string; title?: string; content: string; mediaUrls: string[]; formato?: string; ubicacion?: string; opcionesEncuesta?: string[]; fechaEvento?: string; pageId?: string; marketMeta?: { price: number; status: 'AVAILABLE' } }, token: string) {
  return clienteHttp<Record<string, unknown> & { _id: string; likesCount: number; commentsCount: number }>('/publicaciones', {
    method: 'POST', body: JSON.stringify(datos),
  }, token);
}
export async function listarPublicacionesApi(token: string, vista: 'global' | 'sede' | 'siguiendo' | 'propias' | 'respondidas' = 'global', hubChannel?: string, paginaId?: string) {
  const parametros = new URLSearchParams({ vista, limite: '50' });
  if (hubChannel) parametros.set('hubChannel', hubChannel);
  if (paginaId) parametros.set('pageId', paginaId);
  return clienteHttp<{ publicaciones: Array<Record<string, unknown>>; siguienteCursor: string | null }>(`/publicaciones?${parametros.toString()}`, {}, token);
}
export async function guardarReaccionApi(id: string, type: 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED' | null, token: string) {
  const accion = type === null
    ? await clienteHttp<{ likes: number; dislikes: number; porTipo?: Partial<Record<'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED', number>> }>(`/publicaciones/${encodeURIComponent(id)}/likes`, { method: 'DELETE' }, token)
    : await clienteHttp<{ likes: number; dislikes: number; porTipo?: Partial<Record<'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED', number>> }>(`/publicaciones/${encodeURIComponent(id)}/reacciones`, { method: 'POST', body: JSON.stringify({ type }) }, token);
  return accion;
}
export async function crearComentarioApi(id: string, text: string, token: string) {
  return clienteHttp<Record<string, unknown>>(`/publicaciones/${encodeURIComponent(id)}/comentarios`, { method: 'POST', body: JSON.stringify({ text }) }, token);
}
export async function listarComentariosApi(id: string, token: string) {
  return clienteHttp<{ comentarios: Array<Record<string, unknown>> }>(`/publicaciones/${encodeURIComponent(id)}`, {}, token);
}

export async function listarUsuariosAdminApi(token: string) {
  return clienteHttp<{ usuarios: UsuarioAdministracion[] }>('/administracion/usuarios', {}, token);
}

export async function listarCatalogosPublicosApi() {
  return clienteHttp<{ catalogos: ElementoCatalogoAdministrativo[] }>('/catalogos');
}

export async function listarCatalogosAdminApi(token: string) {
  return clienteHttp<{ catalogos: ElementoCatalogoAdministrativo[] }>('/administracion/catalogos', {}, token);
}
export async function crearElementoCatalogoAdminApi(tipo: TipoCatalogoAdministrativo, datos: Record<string, unknown>, token: string) {
  return clienteHttp<{ elemento: ElementoCatalogoAdministrativo }>(`/administracion/catalogos/${tipo}`, { method: 'POST', body: JSON.stringify(datos) }, token);
}
export async function cambiarEstadoCatalogoAdminApi(tipo: TipoCatalogoAdministrativo, id: string, activo: boolean, token: string) {
  return clienteHttp<{ id: string; activo: boolean }>(`/administracion/catalogos/${tipo}/${encodeURIComponent(id)}/estado`, { method: 'PATCH', body: JSON.stringify({ activo }) }, token);
}

export interface ResumenAdministracionApi {
  usuariosActivos: number; estudiantes: number; profesores: number; moderadores: number;
  administradores: number; baneosActivos: number; reportesPendientes: number; paginasSinVerificar: number;
}
export interface RegistroAuditoriaApi {
  _id: string; actorId: string; actorRole: RolUsuario; action: string; targetType: string;
  targetId: string; actorName?: string; details?: unknown; createdAt: string;
}
export async function obtenerResumenAdminApi(token: string) {
  return clienteHttp<ResumenAdministracionApi>('/administracion/resumen', {}, token);
}
export async function listarAuditoriaAdminApi(token: string, limite = 50) {
  return clienteHttp<{ registros: RegistroAuditoriaApi[] }>(`/administracion/auditoria?limite=${limite}`, {}, token);
}

export async function crearUsuarioAdminApi(datos: CrearCuentaAdministrada, token: string) {
  return clienteHttp<{ usuario: UsuarioAdministracion; claveTemporal: string; mensaje: string }>(
    '/administracion/usuarios',
    { method: 'POST', body: JSON.stringify(datos) },
    token
  );
}

export async function cambiarPerfilUsuarioAdminApi(id: string, perfilId: string, token: string) {
  return clienteHttp<{ perfil: string; accountType: TipoCuenta }>(`/administracion/usuarios/${encodeURIComponent(id)}/perfil`, { method: 'PATCH', body: JSON.stringify({ perfilId }) }, token);
}

export async function banearUsuarioAdminApi(
  id: string,
  reason: string,
  details: string,
  token: string,
  days = 30
) {
  return clienteHttp<{ baneado: boolean; banUntil: string; reason: string }>(
    `/administracion/usuarios/${encodeURIComponent(id)}/baneo`,
    { method: 'PATCH', body: JSON.stringify({ reason, details, days }) },
    token
  );
}

export async function desbanearUsuarioAdminApi(id: string, token: string) {
  return clienteHttp<{ baneado: boolean }>(
    `/administracion/usuarios/${encodeURIComponent(id)}/baneo`,
    { method: 'DELETE' },
    token
  );
}

export async function restablecerContrasenaAdminApi(id: string, token: string) {
  return clienteHttp<{ claveTemporal: string; mensaje: string }>(
    `/administracion/usuarios/${encodeURIComponent(id)}/restablecer-contrasena`,
    { method: 'POST' },
    token
  );
}

export async function cambiarRolAdminApi(id: string, role: RolUsuario, token: string) {
  return clienteHttp<{ usuario: UsuarioAdministracion }>(
    `/administracion/usuarios/${encodeURIComponent(id)}/rol`,
    { method: 'PATCH', body: JSON.stringify({ role }) },
    token
  );
}

export async function cambiarEstadoUsuarioAdminApi(id: string, activo: boolean, token: string) {
  return clienteHttp<{ activo: boolean }>(
    `/administracion/usuarios/${encodeURIComponent(id)}/estado`,
    { method: 'PATCH', body: JSON.stringify({ activo }) },
    token
  );
}

/**
 * Cliente HTTP estandarizado con tipado y manejo de errores.
 */
export async function clienteHttp<T>(
  ruta: string,
  opciones: RequestInit = {},
  token?: string | null
): Promise<T> {
  const urlBase = obtenerApiUrl().replace(/\/$/, '');
  const urlCompleta = `${urlBase}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opciones.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(urlCompleta, {
      ...opciones,
      headers,
    });
  } catch {
    throw new ErrorApi(
      0,
      'No fue posible conectar con el servidor de Poli Social Network. Comprueba la conexión con el servicio de la universidad.'
    );
  }

  let datos: unknown;
  const texto = await respuesta.text();
  try {
    datos = texto ? JSON.parse(texto) : {};
  } catch {
    datos = { mensaje: texto };
  }

  if (!respuesta.ok) {
    const errorBody = datos as { mensaje?: string; error?: string };
    const mensaje = errorBody.mensaje || errorBody.error || `Error ${respuesta.status}: ${respuesta.statusText}`;
    throw new ErrorApi(respuesta.status, mensaje, datos);
  }

  return datos as T;
}

/**
 * Comprueba si el backend está activo.
 */
export async function verificarSalud(): Promise<boolean> {
  try {
    const res = await clienteHttp<{ estado: string }>('/salud');
    return res.estado === 'disponible';
  } catch {
    return false;
  }
}

/**
 * Registra un nuevo usuario en MongoDB vía backend.
 */
export async function registrarUsuarioApi(
  datos: DatosRegistro,
  token: string
): Promise<Usuario> {
  return clienteHttp<Usuario>(
    '/usuarios',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
    token
  );
}

/**
 * Obtiene el perfil propio autenticado.
 */
export async function obtenerMiPerfilApi(token: string): Promise<Usuario> {
  return clienteHttp<Usuario>('/usuarios/mi-perfil', { method: 'GET' }, token);
}

/**
 * Actualiza datos del perfil propio (biografía, semestre, enlaces, avatar).
 */
export async function actualizarMiPerfilApi(
  datos: Partial<{
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    semester: number;
    links: { github?: string | null; linkedin?: string | null };
  }>,
  token: string
): Promise<Usuario> {
  return clienteHttp<Usuario>(
    '/usuarios/mi-perfil',
    {
      method: 'PATCH',
      body: JSON.stringify(datos),
    },
    token
  );
}
