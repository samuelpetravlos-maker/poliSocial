import { Collection, Db, ObjectId } from 'mongodb';
import { enTransaccion } from '../../infraestructura/base_datos/transacciones';
import { Comentario, Publicacion } from './publicacion.modelo';

export class ComentariosRepositorio {
  private readonly comentarios: Collection<Comentario>;
  private readonly publicaciones: Collection<Publicacion>;

  constructor(private readonly baseDeDatos: Db) {
    this.comentarios = baseDeDatos.collection<Comentario>('comments');
    this.publicaciones = baseDeDatos.collection<Publicacion>('posts');
  }

  listar(postId: ObjectId): Promise<Comentario[]> {
    return this.comentarios
      .find({ postId, status: 'VISIBLE' })
      .sort({ isAcceptedAnswer: -1, createdAt: 1 })
      .toArray();
  }

  publicacionesRespondidas(autorId: string) {
    return this.comentarios.distinct('postId', { authorId: autorId, status: 'VISIBLE' });
  }

  buscarPorId(id: string): Promise<Comentario | null> {
    if (!ObjectId.isValid(id)) return Promise.resolve(null);
    return this.comentarios.findOne({ _id: new ObjectId(id) });
  }

  async crear(comentario: Comentario): Promise<Comentario> {
    let creado: Comentario | null = null;
    await enTransaccion(this.baseDeDatos, async (sesion) => {
      const resultado = await this.comentarios.insertOne(comentario, { session: sesion });
      await this.publicaciones.updateOne(
        { _id: comentario.postId },
        { $inc: { commentsCount: 1 } },
        { session: sesion }
      );
      creado = { ...comentario, _id: resultado.insertedId };
    });
    return creado as unknown as Comentario;
  }

  async eliminar(comentarioId: ObjectId, postId: ObjectId): Promise<boolean> {
    return enTransaccion(this.baseDeDatos, async (sesion) => {
      const resultado = await this.comentarios.updateOne(
        { _id: comentarioId, postId, status: 'VISIBLE' },
        { $set: { status: 'DELETED' } },
        { session: sesion }
      );
      if (resultado.modifiedCount === 0) return false;

      await this.publicaciones.updateOne(
        { _id: postId },
        { $inc: { commentsCount: -1 } },
        { session: sesion }
      );
      return true;
    });
  }

  async marcarSolucion(postId: ObjectId, comentarioId: ObjectId): Promise<boolean> {
    return enTransaccion(this.baseDeDatos, async (sesion) => {
      const comentario = await this.comentarios.findOne(
        { _id: comentarioId, postId, status: 'VISIBLE' },
        { session: sesion }
      );
      if (!comentario) return false;

      await this.comentarios.updateMany(
        { postId, isAcceptedAnswer: true },
        { $set: { isAcceptedAnswer: false } },
        { session: sesion }
      );
      await this.comentarios.updateOne(
        { _id: comentarioId },
        { $set: { isAcceptedAnswer: true } },
        { session: sesion }
      );
      await this.publicaciones.updateOne(
        { _id: postId },
        { $set: { isResolved: true, updatedAt: new Date() } },
        { session: sesion }
      );
      return true;
    });
  }
}
