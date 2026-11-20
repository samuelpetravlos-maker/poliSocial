import { clienteHttp, obtenerApiUrl } from '@/servicios/api-cliente';

export interface EstadoUniversitario {
  id: string; autor: string; avatar: string | null; segundos: number; mime: string; vence: string; propio: boolean;
}
export const listarEstados = (token: string) => clienteHttp<EstadoUniversitario[]>('/estados', { cache: 'no-store' }, token);
export const retirarEstado = (id: string, token: string) => clienteHttp('/estados/' + id + '/retirar', { method: 'PATCH' }, token);
export async function publicarEstado(archivo: File, token: string) {
  if (archivo.size > 64 * 1024 * 1024) throw new Error('El archivo supera los 64 MB.');
  return clienteHttp<EstadoUniversitario>('/estados', {
    method: 'POST', headers: { 'Content-Type': archivo.type || 'application/octet-stream', 'X-Nombre-Archivo': encodeURIComponent(archivo.name) }, body: archivo,
  }, token);
}
export async function cargarContenidoEstado(id: string, token: string, signal: AbortSignal) {
  const respuesta = await fetch(obtenerApiUrl().replace(/\/$/,'') + '/estados/' + id + '/archivo', {
    headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal,
  });
  if (!respuesta.ok) throw new Error('El estado venció o ya no está disponible.');
  return respuesta.blob();
}
