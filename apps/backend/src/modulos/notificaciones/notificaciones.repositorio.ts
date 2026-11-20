import { Collection, Db, ObjectId } from 'mongodb';
import { Notificacion } from './notificacion.modelo';

export class NotificacionesRepositorio {
  private readonly notificaciones: Collection<Notificacion>;

  constructor(baseDeDatos: Db) {
    this.notificaciones = baseDeDatos.collection<Notificacion>('notifications');
  }

  async crear(datos: Omit<Notificacion, '_id' | 'isRead' | 'createdAt'>): Promise<Notificacion> {
    const notificacion: Notificacion = { ...datos, isRead: false, createdAt: new Date() };
    const resultado = await this.notificaciones.insertOne(notificacion);
    return { ...notificacion, _id: resultado.insertedId };
  }

  contarNoLeidas(usuarioId: string) {
    return this.notificaciones.countDocuments({ userId: usuarioId, isRead: false });
  }

  listar(usuarioId: string, limite = 30): Promise<Notificacion[]> {
    return this.notificaciones
      .find({ userId: usuarioId })
      .sort({ createdAt: -1 })
      .limit(limite)
      .toArray();
  }

  async marcarLeida(usuarioId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const resultado = await this.notificaciones.updateOne(
      { _id: new ObjectId(id), userId: usuarioId },
      { $set: { isRead: true } }
    );
    return resultado.modifiedCount > 0;
  }

  async marcarTodasLeidas(usuarioId: string): Promise<number> {
    const resultado = await this.notificaciones.updateMany(
      { userId: usuarioId, isRead: false },
      { $set: { isRead: true } }
    );
    return resultado.modifiedCount;
  }
}
