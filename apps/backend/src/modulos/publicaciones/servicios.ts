import { ErrorHttp } from '../../comun/errores';
import { CursorFechaId } from '../../comun/paginacion';
import {
  arregloDeIdentificadores,
  arregloDeTextos,
  enumerado,
  numeroNoNegativo,
  textoOpcional,
  textoRequerido,
} from '../../comun/validacion';
import {
  emitirComentarioNuevo,
  emitirNotificacion,
  emitirPublicacionNueva,
} from '../../infraestructura/tiempo-real/eventos';
import { NotificacionesRepositorio } from '../notificaciones/notificaciones.repositorio';
import { PaginasRepositorio } from '../paginas/paginas.repositorio';
import { BloqueosRepositorio } from '../usuarios/bloqueos.repositorio';
import { SeguidoresRepositorio } from '../usuarios/seguidores.repositorio';
import { Usuario, crearResumenAutor, crearSnapshotAutor } from '../usuarios/usuario.modelo';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { ComentariosRepositorio } from './comentarios.repositorio';
import {
  CANALES,
  CanalPublicacion,
  Comentario,
  EstadoMercado,
  MercadoMeta,
  Publicacion,
} from './publicacion.modelo';
import { PublicacionesRepositorio } from './publicaciones.repositorio';
import { ReaccionesRepositorio, TipoReaccion } from './reacciones.repositorio';

import { validarFormato, EntradaFormato } from './formatos';
import { VotosRepositorio } from './votos.repositorio';

const ESTADOS_MERCADO: readonly EstadoMercado[] = ['AVAILABLE', 'SOLD'];
const VISTAS = ['global', 'sede', 'siguiendo', 'propias', 'respondidas'] as const;
type Vista = (typeof VISTAS)[number];

function validarContenido(valor: unknown, canal: CanalPublicacion, formato: string, adjuntos: string[]) {
  const admiteSoloArchivo = canal === 'GENERAL' && formato === 'NOTICIA' && adjuntos.length > 0;
  if (admiteSoloArchivo && (valor == null || (typeof valor === 'string' && !valor.trim()))) return '';
  return textoRequerido(valor, 'contenido', { max: 5000 });
}

export interface FiltrosMuro {
  vista?: Vista;
  paginaId?: string;
  campus?: string;
  hubChannel?: string;
  cursor?: CursorFechaId | null;
  limite: number;
}

export interface DatosPublicacion extends EntradaFormato {
  hubChannel?: unknown;
  title?: unknown;
  content?: unknown;
  mediaUrls?: unknown;
  tags?: unknown;
  mentions?: unknown;
  marketMeta?: unknown;
  pageId?: unknown;
}

export class PublicacionesServicio {
  constructor(
    private readonly repositorio: PublicacionesRepositorio,
    private readonly reacciones: ReaccionesRepositorio,
    private readonly comentarios: ComentariosRepositorio,
    private readonly seguidores: SeguidoresRepositorio,
    private readonly bloqueos: BloqueosRepositorio,
    private readonly usuarios: UsuariosRepositorio,
    private readonly notificaciones: NotificacionesRepositorio,
    private readonly paginas: PaginasRepositorio,
    private readonly votos: VotosRepositorio
  ) {}

  async crear(usuario: Usuario, datos: DatosPublicacion): Promise<Publicacion> {
    const hubChannel = enumerado(datos.hubChannel, 'hubChannel', CANALES);

    if (hubChannel === 'AVISOS' && (usuario.accountType !== 'PAGE' || !usuario.isVerifiedPoli)) {
      throw new ErrorHttp(403, 'Solo las páginas verificadas pueden publicar avisos institucionales.');
    }

    const pageId = usuario.paginaId ?? null;
    if (datos.pageId && datos.pageId !== pageId) {
      throw new ErrorHttp(403, 'Cambia a la página que deseas utilizar antes de publicar.');
    }
    const authorSnapshot = crearSnapshotAutor(usuario);
    const ahora = new Date();
    const formato = validarFormato(datos, ahora);
    const mediaUrls = arregloDeTextos(datos.mediaUrls, 'archivos', 4, 500);
    const publicacion: Publicacion = {
      ...formato,
      authorId: usuario._id,
      pageId,
      authorSnapshot,
      campus: usuario.campus,
      hubChannel,
      title: this.normalizarTitulo(datos.title, hubChannel),
      content: validarContenido(datos.content, hubChannel, formato.formato, mediaUrls),
      mediaUrls,
      tags: arregloDeTextos(datos.tags, 'tags', 5, 40),
      mentions: arregloDeIdentificadores(datos.mentions, 'mentions', 10),
      marketMeta: this.normalizarMercado(datos.marketMeta, hubChannel),
      isResolved: formato.formato === 'PREGUNTA' || hubChannel === 'ACADEMICO' ? false : null,
      isPinned: false,
      likesCount: 0,
      commentsCount: 0,
      status: 'VISIBLE',
      isEdited: false,
      createdAt: ahora,
      updatedAt: ahora,
    };

    const creada = await this.repositorio.crear(publicacion);
    emitirPublicacionNueva(creada);
    return creada;
  }

  async listar(usuario: Usuario, filtros: FiltrosMuro) {
    const vista: Vista = filtros.vista ?? 'global';
    const bloqueados = await this.bloqueos.idsConBloqueo(usuario._id);

    let autorIds: string[] | undefined;
    let paginasSeguidas: string[] | undefined;
    let campus = usuario.campus;

    if (vista === 'propias') {
      autorIds = [usuario._id];
    } else if (vista === 'sede') {
      campus = usuario.campus;
    } else if (vista === 'siguiendo') {
      const [seguidos, paginas] = await Promise.all([this.seguidores.idsSeguidos(usuario._id), this.paginas.idsSeguidas(usuario._id)]);
      paginasSeguidas = paginas;
      autorIds = seguidos.filter((id) => !bloqueados.includes(id));

      if (autorIds.length === 0 && !paginasSeguidas.length) {
        const sugerencias = await this.usuarios.sugerencias(usuario, 5);
        return {
          vista,
          publicaciones: [],
          siguienteCursor: null,
          sinSeguidos: true,
          sugerencias: sugerencias.map((sugerido) => crearResumenAutor(sugerido)),
        };
      }
    }

    const pagina = await this.repositorio.listar({
      campus: vista === 'sede' ? campus : undefined,
      hubChannel: filtros.hubChannel as CanalPublicacion | undefined,
      autorIds,
      paginasSeguidas,
      paginaId: filtros.paginaId,
      respondidas: vista === 'respondidas' ? await this.comentarios.publicacionesRespondidas(usuario._id) : undefined,
      excluirAutorIds: bloqueados,
      cursor: filtros.cursor,
      limite: filtros.limite,
    });

    let publicaciones = pagina.publicaciones;
    if (vista === 'sede' && !filtros.cursor) {
      const fijadas = await this.repositorio.listarFijados(usuario.campus);
      const existentes = new Set(publicaciones.map((publicacion) => publicacion._id?.toString()));
      publicaciones = [
        ...fijadas.filter((publicacion) => !existentes.has(publicacion._id?.toString())),
        ...publicaciones,
      ];
    }

    return { vista, publicaciones: await this.conResultados(publicaciones, usuario), siguienteCursor: pagina.siguienteCursor };
  }

  async listarGuardadas(usuario: Usuario) {
    const bloqueados = await this.bloqueos.idsConBloqueo(usuario._id);
    return { publicaciones: await this.conResultados(await this.repositorio.listarGuardadas(usuario._id, bloqueados), usuario) };
  }

  async guardarReferencia(usuario: Usuario, id: string, guardar: boolean) {
    const publicacion = await this.obtenerVisible(id, usuario);
    await this.repositorio.guardarReferencia(usuario._id, publicacion._id!, guardar);
    return { guardada: guardar };
  }

  private async conResultados(publicaciones: Publicacion[], usuario: Usuario) {
    const idsEncuestas = publicaciones.flatMap((p) => p.formato === 'ENCUESTA' && p._id ? [p._id] : []);
    const resultados = await this.votos.resultados(idsEncuestas, usuario._id);
    return Promise.all(publicaciones.map(async (publicacion) => {
        if (!publicacion._id) return publicacion;
        const [reacciones, miReaccion] = await Promise.all([
          this.reacciones.resumen(publicacion._id),
          this.reacciones.tipoUsuario(publicacion._id, usuario._id),
        ]);
        return { ...publicacion, reacciones, miReaccion, resultadoEncuesta: resultados.get(publicacion._id.toString()) };
      }));
  }

  async votar(usuario: Usuario, id: string, opcion: unknown) {
    const publicacion = await this.obtenerVisible(id, usuario);
    if (!publicacion._id || publicacion.formato !== 'ENCUESTA') throw new ErrorHttp(400, 'Esta publicación no es una encuesta.');
    if (typeof opcion !== 'number' || !Number.isInteger(opcion) || opcion < 0 || opcion >= (publicacion.opcionesEncuesta?.length ?? 0)) {
      throw new ErrorHttp(400, 'Selecciona una opción de la encuesta.');
    }
    await this.votos.votar(publicacion._id, usuario._id, opcion);
    const resumen = await this.votos.resultados([publicacion._id], usuario._id);
    return resumen.get(publicacion._id.toString());
  }

  async detalle(usuario: Usuario, id: string) {
    const publicacion = await this.repositorio.buscarPorId(id);
    if (!publicacion || publicacion.status === 'DELETED') {
      throw new ErrorHttp(404, 'Publicación no encontrada.');
    }
    if (
      publicacion.status === 'HIDDEN_BY_MOD' &&
      !['MODERATOR', 'ADMIN'].includes(usuario.role)
    ) {
      throw new ErrorHttp(404, 'Publicación no encontrada.');
    }
    if (!publicacion._id) throw new ErrorHttp(404, 'Publicación no encontrada.');

    const [comentarios, reaccionado] = await Promise.all([
      this.comentarios.listar(publicacion._id),
      this.reacciones.existe(publicacion._id, usuario._id),
    ]);

    if ((await this.bloqueos.idsConBloqueo(usuario._id)).includes(publicacion.authorId)) throw new ErrorHttp(404, 'Publicación no encontrada.');
    const [conResultados] = await this.conResultados([publicacion], usuario);
    return { publicacion: conResultados, comentarios, reaccionado };
  }

  async editar(usuario: Usuario, id: string, datos: DatosPublicacion): Promise<Publicacion> {
    const publicacion = await this.repositorio.buscarPorId(id);
    if (!publicacion || publicacion.status === 'DELETED') {
      throw new ErrorHttp(404, 'Publicación no encontrada.');
    }
    if (publicacion.authorId !== usuario._id) {
      throw new ErrorHttp(403, 'Solo el autor puede editar esta publicación.');
    }

    const cambios: Partial<Publicacion> = { isEdited: true };

    if (datos.mediaUrls !== undefined) {
      cambios.mediaUrls = arregloDeTextos(datos.mediaUrls, 'archivos', 4, 500);
    }
    if (datos.content !== undefined || cambios.mediaUrls !== undefined) {
      cambios.content = validarContenido(datos.content ?? publicacion.content, publicacion.hubChannel,
        publicacion.formato ?? 'NOTICIA', cambios.mediaUrls ?? publicacion.mediaUrls);
    }
    if (datos.title !== undefined || publicacion.hubChannel !== 'GENERAL') {
      cambios.title = this.normalizarTitulo(
        datos.title ?? publicacion.title,
        publicacion.hubChannel
      );
    }
    if (datos.tags !== undefined) {
      cambios.tags = arregloDeTextos(datos.tags, 'tags', 5, 40);
    }
    if (datos.mentions !== undefined) {
      cambios.mentions = arregloDeIdentificadores(datos.mentions, 'mentions', 10);
    }
    if (publicacion.hubChannel === 'MERCADO' && datos.marketMeta !== undefined) {
      cambios.marketMeta = this.normalizarMercado(datos.marketMeta, 'MERCADO');
    }

    const actualizada = await this.repositorio.actualizar(id, cambios);
    if (!actualizada) throw new ErrorHttp(404, 'Publicación no encontrada.');
    return actualizada;
  }

  async eliminar(usuario: Usuario, id: string) {
    const publicacion = await this.repositorio.buscarPorId(id);
    if (!publicacion || publicacion.status === 'DELETED') {
      throw new ErrorHttp(404, 'Publicación no encontrada.');
    }
    const esAutor = publicacion.authorId === usuario._id;
    const esModerador = ['MODERATOR', 'ADMIN'].includes(usuario.role);
    if (!esAutor && !esModerador) {
      throw new ErrorHttp(403, 'No tienes permisos para eliminar esta publicación.');
    }

    await this.repositorio.cambiarEstado(id, 'DELETED');
    return { eliminada: true };
  }

  async darLike(usuario: Usuario, id: string) {
    const publicacion = await this.obtenerVisible(id, usuario);
    if (!publicacion._id) throw new ErrorHttp(404, 'Publicación no encontrada.');

    const resultado = await this.reacciones.cambiar(publicacion._id, usuario._id, 'LIKE');
    if (resultado.changed && publicacion.authorId !== usuario._id) {
      await this.notificar(
        publicacion.authorId,
        'LIKE',
        usuario,
        'POST',
        publicacion._id.toString()
      );
    }
    return { reaccionado: true, yaExistia: !resultado.changed, ...(await this.reacciones.resumen(publicacion._id)) };
  }

  async quitarLike(usuario: Usuario, id: string) {
    const publicacion = await this.obtenerVisible(id, usuario);
    if (!publicacion._id) throw new ErrorHttp(404, 'Publicación no encontrada.');
    const eliminado = await this.reacciones.cambiar(publicacion._id, usuario._id, null);
    return { reaccionado: false, eliminado: eliminado.changed, ...(await this.reacciones.resumen(publicacion._id)) };
  }

  async reaccionar(usuario: Usuario, id: string, valor: unknown) {
    const type = enumerado(valor, 'type', ['LIKE', 'DISLIKE', 'LOVE', 'FUN', 'AMAZED'] as const) as TipoReaccion;
    const publicacion = await this.obtenerVisible(id, usuario);
    if (!publicacion._id) throw new ErrorHttp(404, 'Publicación no encontrada.');
    const resultado = await this.reacciones.cambiar(publicacion._id, usuario._id, type);
    if (resultado.changed && type !== 'DISLIKE' && publicacion.authorId !== usuario._id) {
      await this.notificar(publicacion.authorId, 'LIKE', usuario, 'POST', publicacion._id.toString());
    }
    return { ...resultado, ...(await this.reacciones.resumen(publicacion._id)) };
  }

  async comentar(usuario: Usuario, id: string, datos: { text?: unknown }) {
    const publicacion = await this.obtenerVisible(id, usuario);
    if (!publicacion._id) throw new ErrorHttp(404, 'Publicación no encontrada.');

    const comentario: Comentario = {
      postId: publicacion._id,
      authorId: usuario._id,
      authorSnapshot: crearSnapshotAutor(usuario),
      text: textoRequerido(datos.text, 'text', { max: 2000 }),
      isAcceptedAnswer: false,
      status: 'VISIBLE',
      createdAt: new Date(),
    };

    const creado = await this.comentarios.crear(comentario);
    emitirComentarioNuevo(publicacion._id.toString(), creado);

    if (publicacion.authorId !== usuario._id) {
      await this.notificar(
        publicacion.authorId,
        'COMMENT',
        usuario,
        'POST',
        publicacion._id.toString()
      );
    }

    return creado;
  }

  async eliminarComentario(usuario: Usuario, postId: string, comentarioId: string) {
    const publicacion = await this.obtenerVisible(postId, usuario);
    if (!publicacion._id) throw new ErrorHttp(404, 'Publicación no encontrada.');

    const comentario = await this.comentarios.buscarPorId(comentarioId);
    if (
      !comentario ||
      comentario.status === 'DELETED' ||
      !comentario._id ||
      comentario.postId.toString() !== publicacion._id.toString()
    ) {
      throw new ErrorHttp(404, 'Comentario no encontrado.');
    }

    const esAutor = comentario.authorId === usuario._id;
    const esModerador = ['MODERATOR', 'ADMIN'].includes(usuario.role);
    if (!esAutor && !esModerador) {
      throw new ErrorHttp(403, 'No tienes permisos para eliminar este comentario.');
    }

    const eliminado = await this.comentarios.eliminar(comentario._id, publicacion._id);
    return { eliminado };
  }

  async marcarSolucion(usuario: Usuario, postId: string, comentarioId: string) {
    const publicacion = await this.obtenerVisible(postId, usuario);
    if (!publicacion._id) throw new ErrorHttp(404, 'Publicación no encontrada.');
    if (publicacion.authorId !== usuario._id) {
      throw new ErrorHttp(403, 'Solo el autor de la publicación puede marcar la solución.');
    }
    if (publicacion.hubChannel !== 'ACADEMICO' && publicacion.formato !== 'PREGUNTA') {
      throw new ErrorHttp(400, 'Selecciona una respuesta en una pregunta o en el canal académico.');
    }

    const comentario = await this.comentarios.buscarPorId(comentarioId);
    if (!comentario || !comentario._id) {
      throw new ErrorHttp(404, 'Comentario no encontrado.');
    }

    const marcado = await this.comentarios.marcarSolucion(publicacion._id, comentario._id);
    if (!marcado) throw new ErrorHttp(404, 'Comentario no encontrado.');

    if (comentario.authorId !== usuario._id) {
      await this.notificar(
        comentario.authorId,
        'ANSWER_ACCEPTED',
        usuario,
        'COMMENT',
        comentario._id.toString()
      );
    }

    return { resuelto: true };
  }

  private async obtenerVisible(id: string, usuario: Usuario): Promise<Publicacion> {
    const publicacion = await this.repositorio.buscarPorId(id);
    if (!publicacion || publicacion.status !== 'VISIBLE' || (await this.bloqueos.idsConBloqueo(usuario._id)).includes(publicacion.authorId)) {
      throw new ErrorHttp(404, 'Publicación no encontrada.');
    }
    return publicacion;
  }

  private normalizarTitulo(valor: unknown, canal: CanalPublicacion): string | null {
    if (canal === 'GENERAL') {
      return textoOpcional(valor, 'title', { max: 200 });
    }
    return textoRequerido(valor, 'title', { max: 200 });
  }

  private normalizarMercado(valor: unknown, canal: CanalPublicacion): MercadoMeta | null {
    if (canal !== 'MERCADO') return null;
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      throw new ErrorHttp(400, 'El canal Mercado Poli requiere precio y estado del artículo.');
    }

    const datos = valor as Record<string, unknown>;
    return {
      price: numeroNoNegativo(datos.price, 'marketMeta.price'),
      currency: 'COP',
      status: enumerado(datos.status ?? 'AVAILABLE', 'marketMeta.status', ESTADOS_MERCADO),
    };
  }

  private async notificar(
    userId: string,
    tipo: 'LIKE' | 'COMMENT' | 'ANSWER_ACCEPTED',
    actor: Usuario,
    refType: 'POST' | 'COMMENT',
    refId: string
  ): Promise<void> {
    const destino = await this.usuarios.buscarPorIdentificador(userId);
    if (!destino) return;

    const preferencias = destino.notificationPrefs;
    if (tipo === 'LIKE' && preferencias?.likes === false) return;
    if (tipo !== 'LIKE' && preferencias?.comments === false) return;

    const notificacion = await this.notificaciones.crear({
      userId,
      type: tipo,
      actorSnapshot: {
        uid: actor._id,
        displayName: actor.displayName,
        avatarUrl: actor.avatarUrl ?? null,
      },
      refType,
      refId,
    });
    emitirNotificacion(userId, notificacion);
  }
}
