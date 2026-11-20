import { Collection, Db, ObjectId } from 'mongodb';
import { Usuario } from '../usuarios/usuario.modelo';
import { EstadoReporte, ReporteColeccion, TipoObjetivoReporte } from './colecciones';

const COLECCIONES_OBJETIVO: Record<TipoObjetivoReporte, { nombre: string; usaObjectId: boolean }> = {
  POST: { nombre: 'posts', usaObjectId: true },
  COMMENT: { nombre: 'comments', usaObjectId: true },
  USER: { nombre: 'users', usaObjectId: false },
  PAGE: { nombre: 'pages', usaObjectId: true },
  MESSAGE: { nombre: 'messages', usaObjectId: true },
};

export interface DatosAuditoriaModeracion {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}

export class ModeracionRepositorio {
  private readonly reportes: Collection<ReporteColeccion>;

  constructor(private readonly baseDeDatos: Db) {
    this.reportes = baseDeDatos.collection<ReporteColeccion>('reports');
  }

  async existeObjetivo(tipo: TipoObjetivoReporte, id: string): Promise<boolean> {
    const configuracion = COLECCIONES_OBJETIVO[tipo];
    if (configuracion.usaObjectId && !ObjectId.isValid(id)) return false;
    const idMongo = configuracion.usaObjectId ? new ObjectId(id) : id;
    const resultado = await this.baseDeDatos
      .collection<{ _id: ObjectId | string }>(configuracion.nombre)
      .findOne({ _id: idMongo });
    return Boolean(resultado);
  }

  buscarReporteActivo(reporterId: string, targetType: TipoObjetivoReporte, targetId: string) {
    return this.reportes.findOne({
      reporterId,
      targetType,
      targetId,
      status: { $in: ['PENDING', 'REVIEWING'] },
    });
  }

  async crearReporte(datos: Omit<ReporteColeccion, '_id'>): Promise<ReporteColeccion> {
    const insertado = await this.reportes.insertOne(datos);
    return { ...datos, _id: insertado.insertedId };
  }

  listarReportes(estado?: EstadoReporte): Promise<ReporteColeccion[]> {
    const filtro = estado ? { status: estado } : { status: { $in: ['PENDING', 'REVIEWING'] as EstadoReporte[] } };
    return this.reportes.find(filtro).sort({ createdAt: 1 }).limit(100).toArray();
  }

  buscarReporte(id: ObjectId) {
    return this.reportes.findOne({ _id: id });
  }

  async ocultarPublicacion(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const resultado = await this.baseDeDatos.collection('posts').updateOne(
      { _id: new ObjectId(id), status: { $nin: ['DELETED', 'HIDDEN_BY_MOD'] } },
      { $set: { status: 'HIDDEN_BY_MOD', updatedAt: new Date() } }
    );
    return resultado.matchedCount > 0;
  }

  buscarUsuario(id: string, soloActivo = false) {
    return this.baseDeDatos.collection<Usuario>('users').findOne({ _id: id, ...(soloActivo ? { status: 'ACTIVE' } : {}) });
  }

  async aplicarBaneo(id: string, motivo: string, detalles: string, fechaFin: Date): Promise<void> {
    await this.baseDeDatos.collection<Usuario>('users').updateOne(
      { _id: id },
      { $inc: { sessionVersion: 1 }, $set: { banUntil: fechaFin, banReason: motivo, banDetails: detalles, updatedAt: new Date() } }
    );
  }

  async resolverContenidoReportado(tipo: string, id: string, accion: 'OCULTAR' | 'ELIMINAR'): Promise<boolean> {
    const nombreColeccion = tipo === 'POST' ? 'posts' : tipo === 'COMMENT' ? 'comments' : null;
    if (!nombreColeccion || !ObjectId.isValid(id)) return false;
    const resultado = await this.baseDeDatos.collection(nombreColeccion).updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: accion === 'OCULTAR' ? 'HIDDEN_BY_MOD' : 'DELETED', updatedAt: new Date() } }
    );
    return resultado.matchedCount > 0;
  }

  actualizarResolucion(id: ObjectId, estado: EstadoReporte, asignadoA: string, resolucion: string) {
    return this.reportes.findOneAndUpdate(
      { _id: id },
      { $set: { status: estado, assignedTo: asignadoA, resolution: resolucion, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  async listarModeradoresActivos(): Promise<string[]> {
    const usuarios = await this.baseDeDatos.collection<Usuario>('users')
      .find({ role: 'MODERATOR', status: 'ACTIVE' })
      .project({ _id: 1 })
      .toArray();
    return usuarios.map((usuario) => usuario._id);
  }

  existeNotificacionReporte(usuarioId: string, reporteId: string) {
    return this.baseDeDatos.collection('notifications').findOne({
      userId: usuarioId,
      type: 'CONTENT_REPORTED',
      refType: 'REPORT',
      refId: reporteId,
    });
  }

  registrarAuditoria(datos: DatosAuditoriaModeracion) {
    return this.baseDeDatos.collection('auditLogs').insertOne({ ...datos, createdAt: new Date() });
  }
}
