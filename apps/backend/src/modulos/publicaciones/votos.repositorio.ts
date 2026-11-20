import { Db, ObjectId } from 'mongodb';

interface Voto {
  _id: string;
  publicacionId: ObjectId;
  usuarioId: string;
  opcion: number;
}

export class VotosRepositorio {
  constructor(private readonly base: Db) {}

  async votar(publicacionId: ObjectId, usuarioId: string, opcion: number) {
    // La clave única conserva un voto por identidad cuando se reintenta o cambia la opción.
    await this.base.collection<Voto>('votosEncuesta').updateOne(
      { _id: publicacionId.toHexString() + ':' + usuarioId },
      { $setOnInsert: { publicacionId, usuarioId }, $set: { opcion } },
      { upsert: true }
    );
  }

  async resultados(ids: ObjectId[], usuarioId: string) {
    const resumen = new Map<string, { totales: Record<number, number>; miOpcion: number | null }>();
    if (!ids.length) return resumen;
    const filas = await this.base.collection<Voto>('votosEncuesta').aggregate<{
      _id: { publicacion: ObjectId; opcion: number }; total: number; propio: boolean;
    }>([
      { $match: { publicacionId: { $in: ids } } },
      { $group: {
        _id: { publicacion: '$publicacionId', opcion: '$opcion' },
        total: { $sum: 1 }, propio: { $max: { $eq: ['$usuarioId', { $literal: usuarioId }] } },
      } },
    ]).toArray();
    for (const fila of filas) {
      const id = fila._id.publicacion.toHexString();
      const resultado = resumen.get(id) ?? { totales: {} as Record<number, number>, miOpcion: null };
      resultado.totales[fila._id.opcion] = fila.total;
      if (fila.propio) resultado.miOpcion = fila._id.opcion;
      resumen.set(id, resultado);
    }
    return resumen;
  }
}
