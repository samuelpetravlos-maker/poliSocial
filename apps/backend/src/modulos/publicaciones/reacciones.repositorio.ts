import { Collection, Db, ObjectId } from 'mongodb';
import { enTransaccion } from '../../infraestructura/base_datos/transacciones';
import { Publicacion, Reaccion } from './publicacion.modelo';

export type TipoReaccion = 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED';

export class ReaccionesRepositorio {
  private readonly reacciones: Collection<Reaccion>;
  private readonly publicaciones: Collection<Publicacion>;

  constructor(private readonly baseDeDatos: Db) {
    this.reacciones = baseDeDatos.collection<Reaccion>('reactions');
    this.publicaciones = baseDeDatos.collection<Publicacion>('posts');
  }

  async existe(postId: ObjectId, userId: string): Promise<boolean> {
    return (await this.reacciones.findOne({ postId, userId })) !== null;
  }

  async cambiar(postId: ObjectId, userId: string, type: TipoReaccion | null) {
    return enTransaccion(this.baseDeDatos, async (sesion) => {
      const previa = await this.reacciones.findOne({ postId, userId }, { session: sesion });
      const tipoPrevio = previa?.type ?? 'LIKE';
      const eraPositiva = previa && tipoPrevio !== 'DISLIKE';
      const esPositiva = type !== null && type !== 'DISLIKE';
      if (previa && type === null) {
        await this.reacciones.deleteOne({ _id: previa._id }, { session: sesion });
      } else if (type && previa) {
        await this.reacciones.updateOne({ _id: previa._id }, { $set: { type } }, { session: sesion });
      } else if (type) {
        await this.reacciones.insertOne({ postId, userId, type, createdAt: new Date() }, { session: sesion });
      }
      const delta = Number(esPositiva) - Number(Boolean(eraPositiva));
      if (delta) await this.publicaciones.updateOne({ _id: postId }, { $inc: { likesCount: delta } }, { session: sesion });
      return { type, changed: (previa?.type ?? (previa ? 'LIKE' : null)) !== type };
    });
  }

  async resumen(postId: ObjectId) {
    const conteo = await this.reacciones.aggregate<{ _id: string; total: number }>([
      { $match: { postId } },
      { $group: { _id: { $ifNull: ['$type', 'LIKE'] }, total: { $sum: 1 } } },
    ]).toArray();
    const porTipo = Object.fromEntries(conteo.map((r) => [r._id, r.total]));
    return {
      likes: (porTipo.LIKE ?? 0) + (porTipo.LOVE ?? 0) + (porTipo.FUN ?? 0) + (porTipo.AMAZED ?? 0),
      dislikes: porTipo.DISLIKE ?? 0,
      porTipo,
    };
  }

  async tipoUsuario(postId: ObjectId, userId: string): Promise<TipoReaccion | null> {
    const reaccion = await this.reacciones.findOne({ postId, userId });
    return reaccion ? reaccion.type ?? 'LIKE' : null;
  }
}
