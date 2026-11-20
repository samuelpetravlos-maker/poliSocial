import { Collection, Db } from 'mongodb';
import { esConflictoDuplicado } from '../../comun/errores';
import { Bloqueo } from './bloqueo.modelo';

export class BloqueosRepositorio {
  private readonly bloqueos: Collection<Bloqueo>;

  constructor(baseDeDatos: Db) {
    this.bloqueos = baseDeDatos.collection<Bloqueo>('blocks');
  }

  async existeBloqueo(usuarioA: string, usuarioB: string): Promise<boolean> {
    const bloqueo = await this.bloqueos.findOne({
      $or: [
        { _id: `${usuarioA}_${usuarioB}` },
        { _id: `${usuarioB}_${usuarioA}` },
      ],
    });
    return bloqueo !== null;
  }

  async bloquear(blockerId: string, blockedId: string): Promise<boolean> {
    try {
      await this.bloqueos.insertOne({
        _id: `${blockerId}_${blockedId}`,
        blockerId,
        blockedId,
        createdAt: new Date(),
      });
      return true;
    } catch (error) {
      if (esConflictoDuplicado(error)) return false;
      throw error;
    }
  }

  async desbloquear(blockerId: string, blockedId: string): Promise<boolean> {
    const resultado = await this.bloqueos.deleteOne({ _id: `${blockerId}_${blockedId}` });
    return resultado.deletedCount > 0;
  }

  async idsConBloqueo(usuarioId: string): Promise<string[]> {
    const bloqueos = await this.bloqueos
      .find({ $or: [{ blockerId: usuarioId }, { blockedId: usuarioId }] })
      .toArray();

    return bloqueos.map((bloqueo) =>
      bloqueo.blockerId === usuarioId ? bloqueo.blockedId : bloqueo.blockerId
    );
  }
}
