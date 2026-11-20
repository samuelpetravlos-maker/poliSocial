import { Collection, Db, Filter, ObjectId } from 'mongodb';
import { codificarCursor, CursorFechaId } from '../../comun/paginacion';
import { Sede } from '../usuarios/usuario.modelo';
import { CanalPublicacion, EstadoPublicacion, Publicacion } from './publicacion.modelo';

export interface FiltroFeed {
  campus?: Sede;
  hubChannel?: CanalPublicacion;
  autorIds?: string[];
  paginasSeguidas?: string[];
  paginaId?: string;
  respondidas?: ObjectId[];
  excluirAutorIds?: string[];
  cursor?: CursorFechaId | null;
  limite: number;
}

export interface PaginaPublicaciones {
  publicaciones: Publicacion[];
  siguienteCursor: string | null;
}

export class PublicacionesRepositorio {
  private readonly publicaciones: Collection<Publicacion>;

  private readonly referencias: Collection<{ _id: string; usuarioId: string; postId: ObjectId; activa: boolean; fecha: Date }>;

  constructor(baseDeDatos: Db) {
    this.referencias = baseDeDatos.collection('publicacionesGuardadas');
    this.publicaciones = baseDeDatos.collection<Publicacion>('posts');
  }

  async guardarReferencia(usuarioId: string, postId: ObjectId, activa: boolean) {
    const clave = postId.toHexString() + ':' + usuarioId;
    await this.referencias.updateOne({ _id: clave }, {
      $setOnInsert: { usuarioId, postId }, $set: { activa, fecha: new Date() },
    }, { upsert: activa });
  }

  async listarGuardadas(usuarioId: string, bloqueados: string[]) {
    return this.referencias.aggregate<Publicacion>([
      { $match: { usuarioId, activa: true } }, { $sort: { fecha: -1 } },
      { $lookup: { from: 'posts', localField: 'postId', foreignField: '_id', as: 'publicacion' } },
      { $unwind: '$publicacion' }, { $replaceWith: '$publicacion' },
      { $match: { status: 'VISIBLE', authorId: { $nin: bloqueados } } },
    ]).toArray();
  }

  async crear(publicacion: Publicacion): Promise<Publicacion> {
    const resultado = await this.publicaciones.insertOne(publicacion);
    return { ...publicacion, _id: resultado.insertedId };
  }

  buscarPorId(id: string): Promise<Publicacion | null> {
    if (!ObjectId.isValid(id)) return Promise.resolve(null);
    return this.publicaciones.findOne({ _id: new ObjectId(id) });
  }

  async listar(filtro: FiltroFeed): Promise<PaginaPublicaciones> {
    if (filtro.autorIds && filtro.autorIds.length === 0 && !filtro.paginasSeguidas?.length) {
      return { publicaciones: [], siguienteCursor: null };
    }

    const consulta: Filter<Publicacion> = { status: 'VISIBLE' };
    if (filtro.campus) consulta.campus = filtro.campus;
    if (filtro.hubChannel) consulta.hubChannel = filtro.hubChannel;
    if (filtro.respondidas) consulta._id = { $in: filtro.respondidas };
    if (filtro.paginaId) consulta.pageId = filtro.paginaId;
    if (filtro.autorIds) {
      consulta.$and = [{ $or: [{ authorId: { $in: filtro.autorIds } }, { pageId: { $in: filtro.paginasSeguidas ?? [] } }] }];
    }
    if (filtro.excluirAutorIds && filtro.excluirAutorIds.length > 0) {
      consulta.authorId = { $nin: filtro.excluirAutorIds };
    }

    if (filtro.cursor && ObjectId.isValid(filtro.cursor.id)) {
      const idCursor = new ObjectId(filtro.cursor.id);
      consulta.$or = [
        { createdAt: { $lt: filtro.cursor.fecha } },
        { createdAt: filtro.cursor.fecha, _id: { $lt: idCursor } },
      ];
    }

    const documentos = await this.publicaciones
      .find(consulta)
      .sort({ createdAt: -1, _id: -1 })
      .limit(filtro.limite + 1)
      .toArray();

    const hayMas = documentos.length > filtro.limite;
    const publicaciones = hayMas ? documentos.slice(0, filtro.limite) : documentos;
    const ultima = publicaciones[publicaciones.length - 1];

    return {
      publicaciones,
      siguienteCursor:
        hayMas && ultima?._id
          ? codificarCursor(ultima.createdAt, ultima._id.toString())
          : null,
    };
  }

  listarFijados(campus: Sede, limite = 3): Promise<Publicacion[]> {
    return this.publicaciones
      .find({ status: 'VISIBLE', campus, isPinned: true })
      .sort({ createdAt: -1 })
      .limit(limite)
      .toArray();
  }

  actualizar(id: string, cambios: Partial<Publicacion>): Promise<Publicacion | null> {
    if (!ObjectId.isValid(id)) return Promise.resolve(null);
    return this.publicaciones.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...cambios, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  async cambiarEstado(id: string, estado: EstadoPublicacion): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const resultado = await this.publicaciones.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: estado, updatedAt: new Date() } }
    );
    return resultado.modifiedCount > 0;
  }

  async incrementarContador(
    id: ObjectId,
    campo: 'likesCount' | 'commentsCount',
    delta: number
  ): Promise<void> {
    await this.publicaciones.updateOne({ _id: id }, { $inc: { [campo]: delta } });
  }
}
