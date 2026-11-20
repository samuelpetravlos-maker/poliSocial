import { Collection, Db, Filter } from 'mongodb';
import { codificarCursor, CursorFechaId } from '../../comun/paginacion';
import { esConflictoDuplicado } from '../../comun/errores';
import { enTransaccion } from '../../infraestructura/base_datos/transacciones';
import { Seguimiento } from './bloqueo.modelo';
import { Usuario } from './usuario.modelo';

export interface PaginaSeguimientos {
  seguimientos: Seguimiento[];
  siguienteCursor: string | null;
}

export class SeguidoresRepositorio {
  private readonly follows: Collection<Seguimiento>;
  private readonly usuarios: Collection<Usuario>;

  constructor(private readonly baseDeDatos: Db) {
    this.follows = baseDeDatos.collection<Seguimiento>('follows');
    this.usuarios = baseDeDatos.collection<Usuario>('users');
  }

  async seguir(followerId: string, followingId: string): Promise<boolean> {
    try {
      await enTransaccion(this.baseDeDatos, async (sesion) => {
        await this.follows.insertOne(
          {
            _id: `${followerId}_${followingId}`,
            followerId,
            followingId,
            createdAt: new Date(),
          },
          { session: sesion }
        );
        await this.usuarios.updateOne(
          { _id: followerId },
          { $inc: { followingCount: 1 } },
          { session: sesion }
        );
        await this.usuarios.updateOne(
          { _id: followingId },
          { $inc: { followersCount: 1 } },
          { session: sesion }
        );
      });
      return true;
    } catch (error) {
      if (esConflictoDuplicado(error)) return false;
      throw error;
    }
  }

  async dejarDeSeguir(followerId: string, followingId: string): Promise<boolean> {
    return enTransaccion(this.baseDeDatos, async (sesion) => {
      const resultado = await this.follows.deleteOne(
        { _id: `${followerId}_${followingId}` },
        { session: sesion }
      );
      if (resultado.deletedCount === 0) return false;

      await this.usuarios.updateOne(
        { _id: followerId },
        { $inc: { followingCount: -1 } },
        { session: sesion }
      );
      await this.usuarios.updateOne(
        { _id: followingId },
        { $inc: { followersCount: -1 } },
        { session: sesion }
      );
      return true;
    });
  }

  esSiguiendo(followerId: string, followingId: string): Promise<boolean> {
    return this.follows
      .findOne({ _id: `${followerId}_${followingId}` })
      .then((seguimiento) => seguimiento !== null);
  }

  async idsSeguidos(followerId: string, limite = 5000): Promise<string[]> {
    const seguimientos = await this.follows
      .find({ followerId })
      .project({ followingId: 1 })
      .limit(limite)
      .toArray();
    return seguimientos.map((seguimiento) => seguimiento.followingId);
  }

  async listarSeguidos(
    followerId: string,
    limite: number,
    cursor?: CursorFechaId | null
  ): Promise<PaginaSeguimientos> {
    return this.listar({ followerId }, limite, cursor);
  }

  async listarSeguidores(
    followingId: string,
    limite: number,
    cursor?: CursorFechaId | null
  ): Promise<PaginaSeguimientos> {
    return this.listar({ followingId }, limite, cursor);
  }

  private async listar(
    base: Filter<Seguimiento>,
    limite: number,
    cursor?: CursorFechaId | null
  ): Promise<PaginaSeguimientos> {
    const consulta: Filter<Seguimiento> = { ...base };
    if (cursor) {
      consulta.$or = [
        { createdAt: { $lt: cursor.fecha } },
        { createdAt: cursor.fecha, _id: { $lt: cursor.id } },
      ];
    }

    const documentos = await this.follows
      .find(consulta)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limite + 1)
      .toArray();

    const hayMas = documentos.length > limite;
    const seguimientos = hayMas ? documentos.slice(0, limite) : documentos;
    const ultimo = seguimientos[seguimientos.length - 1];

    return {
      seguimientos,
      siguienteCursor:
        hayMas && ultimo ? codificarCursor(ultimo.createdAt, ultimo._id) : null,
    };
  }
}
