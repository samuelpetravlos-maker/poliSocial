import { obtenerApiUrl } from '@/modulos/archivos/servicios/servicio-api';
import type { AutorSocial, Canal, ConversacionSocial, PublicacionSocial, Sede } from '@/datos/modelos-sociales';
import type { ChatApi } from '@/servicios/api-cliente';

/** Convierte el contrato HTTP actual al modelo que representa una publicación en la web. */
export function adaptarPublicacionApi(datos: Record<string, unknown>): PublicacionSocial {
  const autor = (datos.authorSnapshot ?? {}) as Record<string, unknown>;
  const reaccion = (datos.reacciones ?? {}) as Record<string, unknown>;
  const porTipo = (reaccion.porTipo ?? {}) as PublicacionSocial['reaccionesPorTipo'];
  const mediaUrls = Array.isArray(datos.mediaUrls) ? datos.mediaUrls.filter((valor): valor is string => typeof valor === 'string') : [];
  const origenApi = obtenerApiUrl().replace(/\/api\/?$/, '');
  const archivos = mediaUrls.map((url) => {
    const ruta = url.toLowerCase();
    const mime = /\.(png)$/.test(ruta) ? 'image/png' : /\.(jpe?g)$/.test(ruta) ? 'image/jpeg' : /\.gif$/.test(ruta) ? 'image/gif' : /\.webp$/.test(ruta) ? 'image/webp' : /\.mp4$/.test(ruta) ? 'video/mp4' : /\.webm$/.test(ruta) ? 'video/webm' : /\.mov$/.test(ruta) ? 'video/quicktime' : 'application/pdf';
    return { url: /^https?:/.test(url) ? url : `${origenApi}${url}`, nombre: url.split('/').pop() ?? 'Adjunto', mime };
  });
  const mercado = datos.marketMeta as Record<string, unknown> | null;
  const miReaccion = typeof datos.miReaccion === 'string' ? datos.miReaccion as PublicacionSocial['reaccionTipo'] : null;
  return {
    id: String(datos._id ?? ''),
    formato: (datos.formato ?? 'NOTICIA') as PublicacionSocial['formato'],
    ubicacion: typeof datos.ubicacion === 'string' ? datos.ubicacion : undefined,
    fechaEvento: typeof datos.fechaEvento === 'string' ? datos.fechaEvento : undefined,
    opcionesEncuesta: Array.isArray(datos.opcionesEncuesta) ? datos.opcionesEncuesta.map(String) : undefined,
    resultadoEncuesta: datos.resultadoEncuesta as PublicacionSocial['resultadoEncuesta'],
    paginaId: typeof datos.pageId === 'string' ? datos.pageId : undefined,
    autor: {
      id: String(datos.authorId ?? ''), nombre: String(autor.displayName ?? 'Cuenta Poli'),
      usuario: String(autor.username ?? 'usuario'), sede: (autor.campus ?? datos.campus ?? 'MEDELLIN') as Sede,
      etiquetaSede: typeof autor.campusLabel === 'string' ? autor.campusLabel : undefined,
      programa: String(autor.program ?? 'Comunidad PJIC'), verificado: Boolean(autor.isVerifiedPoli),
      color: '#1b5e20', tipoCuenta: (autor.accountType as AutorSocial['tipoCuenta']) ?? 'STUDENT',
      etiquetaPerfil: typeof autor.accountLabel === 'string' ? autor.accountLabel : undefined,
      avatarUrl: typeof autor.avatarUrl === 'string' ? autor.avatarUrl : null,
    },
    canal: (datos.hubChannel ?? 'GENERAL') as Canal,
    titulo: typeof datos.title === 'string' ? datos.title : undefined,
    contenido: String(datos.content ?? ''), etiquetas: Array.isArray(datos.tags) ? datos.tags.filter((valor): valor is string => typeof valor === 'string') : [],
    likes: Number(reaccion.likes ?? datos.likesCount ?? 0), dislikes: Number(reaccion.dislikes ?? 0),
    reaccionesPorTipo: porTipo, reaccionTipo: miReaccion, reaccionado: Boolean(miReaccion && miReaccion !== 'DISLIKE'),
    comentarios: [], comentariosCount: Number(datos.commentsCount ?? 0),
    fecha: datos.createdAt ? new Date(String(datos.createdAt)).toLocaleString('es-CO') : 'Ahora',
    fijado: Boolean(datos.isPinned), resuelto: Boolean(datos.isResolved), archivos,
    mercado: mercado ? { precio: `$${Number(mercado.price ?? 0).toLocaleString('es-CO')} COP`, estado: mercado.status === 'SOLD' ? 'Vendido' : 'Disponible' } : undefined,
  };
}

/** Adapta una conversación persistida a la vista compacta de la bandeja. */
export function adaptarChatApi(chat: ChatApi, usuarioId: string): ConversacionSocial {
  const otroId = chat.participantIds.find((id) => id !== usuarioId) ?? usuarioId;
  const otro = chat.participantsInfo[otroId];
  const nombre = chat.type === 'GROUP' ? chat.groupName || 'Grupo de estudio' : otro?.displayName || 'Conversación';
  const ultimo = chat.lastMessage?.text ?? 'Inicia la conversación';
  return {
    id: chat._id, nombre, descripcion: chat.type === 'GROUP' ? 'Chat grupal' : otro?.program ?? 'Chat directo',
    tipo: chat.type === 'GROUP' ? 'grupo' : 'directo', iniciales: nombre.split(/\s+/).slice(0, 2).map((valor) => valor[0]).join('').toUpperCase(),
    color: '#1b5e20', ultimo, hora: chat.lastMessage?.sentAt ? new Date(chat.lastMessage.sentAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '',
    noLeidos: chat.unreadCounts[usuarioId] ?? 0, mensajes: [],
  };
}
