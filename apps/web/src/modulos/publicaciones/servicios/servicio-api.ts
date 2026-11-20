export {
  crearComentarioApi,
  crearPublicacionApi,
  guardarReaccionApi,
  listarComentariosApi,
  listarPublicacionesApi,
} from '@/servicios/api-cliente';

import { clienteHttp } from '@/servicios/api-cliente';
import type { ResultadoEncuesta } from '@/datos/modelos-sociales';

export const votarEncuesta = (id: string, opcion: number, token: string) =>
  clienteHttp<ResultadoEncuesta>(`/publicaciones/${encodeURIComponent(id)}/voto`, { method: 'PUT', body: JSON.stringify({ opcion }) }, token);

export const editarPublicacion = (id: string, contenido: string, token: string) =>
  clienteHttp(`/publicaciones/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ content: contenido }) }, token);

export const retirarPublicacion = (id: string, token: string) =>
  clienteHttp(`/publicaciones/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);

export const aceptarRespuesta = (id: string, comentarioId: string, token: string) =>
  clienteHttp(`/publicaciones/${encodeURIComponent(id)}/comentarios/${encodeURIComponent(comentarioId)}/solucion`, { method: 'POST' }, token);

export const guardarReferencia = (id: string, activa: boolean, token: string) =>
  clienteHttp(`/publicaciones/${encodeURIComponent(id)}/guardada`, { method: activa ? 'PUT' : 'DELETE' }, token);

export const cargarGuardadas = (token: string) =>
  clienteHttp<{ publicaciones: Record<string, unknown>[] }>('/publicaciones/guardadas', {}, token);

export const obtenerPublicacion = (id: string, token: string) =>
  clienteHttp<{ publicacion: Record<string, unknown> }>(`/publicaciones/${encodeURIComponent(id)}`, {}, token);
