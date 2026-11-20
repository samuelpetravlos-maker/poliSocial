import { createHash } from 'node:crypto';
import { ErrorHttp } from '../../comun/errores';
import { Usuario } from '../usuarios/usuario.modelo';
import { Collection, Db, ObjectId } from 'mongodb';
import { PaginaColeccion } from './colecciones';

import { sincronizarCuentaPagina } from './identidades';

export type PaginaPersistida = PaginaColeccion & { _id: ObjectId };
export type PaginaConSeguimiento = PaginaPersistida & { siguiendo: boolean };

export class PaginasRepositorio {
  private readonly paginas: Collection<PaginaColeccion>;
  private readonly seguimientos: Collection<{ pageId: ObjectId; userId: string; createdAt: Date }>;

  constructor(private readonly baseDeDatos: Db) {
    this.paginas = baseDeDatos.collection<PaginaColeccion>('pages');
    this.seguimientos = baseDeDatos.collection('pageFollows');
  }

  async listar(usuarioId: string, paginaId?: string, administracion = false): Promise<PaginaConSeguimiento[]> {
    const filtroPropias = paginaId && ObjectId.isValid(paginaId)
      ? { $or: [{ propietarioId: usuarioId }, { _id: new ObjectId(paginaId) }] }
      : { propietarioId: usuarioId };
    const [propias, recientes, pendientes] = await Promise.all([
      this.paginas.find(filtroPropias).sort({ createdAt: -1 }).toArray(),
      this.paginas.find({}).sort({ createdAt: -1 }).limit(100).toArray(),
      administracion ? this.paginas.find({ solicitudVerificacion: { $exists: true } }).sort({ solicitudVerificacion: 1 }).toArray() : [],
    ]);
    const paginas = Array.from(new Map([...pendientes, ...propias, ...recientes].map(p => [p._id.toString(), p])).values());
    const ids = paginas.flatMap((pagina) => pagina._id ? [pagina._id] : []);
    const seguimientos = await this.seguimientos.find({ userId: usuarioId, pageId: { $in: ids } }).toArray();
    const seguidas = new Set(seguimientos.map((seguimiento) => seguimiento.pageId.toString()));
    return paginas.flatMap((pagina) => pagina._id ? [{ ...pagina, _id: pagina._id, siguiendo: seguidas.has(pagina._id.toString()) }] : []);
  }

  async idsSeguidas(usuarioId: string) {
    const seguimientos = await this.seguimientos.find({ userId: usuarioId }, { projection: { pageId: 1 } }).toArray();
    return seguimientos.map(s => s.pageId.toHexString());
  }

  buscarPorId(id: string): Promise<PaginaPersistida | null> {
    if (!ObjectId.isValid(id)) return Promise.resolve(null);
    return this.paginas.findOne({ _id: new ObjectId(id) }) as Promise<PaginaPersistida | null>;
  }

  async categoriaActiva(nombre: string, personal = false) {
    const categorias = this.baseDeDatos.collection('pageCategories');
    if (!await categorias.findOne({}, { projection: { _id: 1 } })) return nombre === 'Comunidad' || nombre === 'Institucional';
    const categoria = await categorias.findOne({ name: nombre, status: { $ne: 'INACTIVE' } });
    return !!categoria && (personal || !(categoria.soloPersonal ?? categoria.name === 'Servicio institucional'));
  }

  async nombreExiste(nombreNormalizado: string, excluirId?: ObjectId): Promise<boolean> {
    const filtro = excluirId ? { nombreNormalizado, _id: { $ne: excluirId } } : { nombreNormalizado };
    return Boolean(await this.paginas.findOne(filtro, { projection: { _id: 1 } }));
  }

  async crear(datos: Omit<PaginaColeccion, '_id'>): Promise<PaginaPersistida> {
    const insertado = await this.paginas.insertOne(datos);
    return { ...datos, _id: insertado.insertedId };
  }

  async actualizarDatos(id: ObjectId, cambios: Partial<PaginaColeccion>) {
    const pagina = await this.paginas.findOneAndUpdate({ _id: id }, { $set: cambios }, { returnDocument: 'after' });
    if (pagina) await sincronizarCuentaPagina(this.baseDeDatos, pagina);
    return pagina;
  }

  async solicitarVerificacion(usuario: Usuario, id: string) {
    const pagina = await this.buscarPorId(id);
    if (!pagina) throw new ErrorHttp(404, 'Página no encontrada.');
    if (usuario.role !== 'USER' || (pagina.propietarioId !== usuario._id && usuario.paginaId !== id)) {
      throw new ErrorHttp(403, 'Solo el titular puede solicitar la verificación.');
    }
    const filtro = { _id: pagina._id, isVerified: false };
    const nueva = await this.paginas.findOneAndUpdate({ ...filtro, solicitudVerificacion: { $exists: false } },
      { $set: { solicitudVerificacion: new Date(), verificationStatus: 'PENDING' } }, { returnDocument: 'after' });
    const pendiente = nueva ?? await this.paginas.findOne(filtro);
    if (!pendiente?.solicitudVerificacion) throw new ErrorHttp(409, 'La solicitud ya fue resuelta.');
    const administradores = await this.baseDeDatos.collection<Usuario>('users')
      .find({ role: 'ADMIN', status: 'ACTIVE' }).project<{ _id: string }>({ _id: 1 }).toArray();
    for (const admin of administradores) {
      const clave = [id, pendiente.solicitudVerificacion.toISOString(), admin._id].join('/');
      const avisoId = new ObjectId(createHash('sha256').update(clave).digest('hex').slice(0, 24));
      await this.baseDeDatos.collection('notifications').updateOne({ _id: avisoId }, { $setOnInsert: {
        userId: admin._id, type: 'PAGE_VERIFICATION', refType: 'PAGE', refId: id,
        actorSnapshot: { uid: usuario._id, displayName: pagina.nombre, avatarUrl: pagina.avatarUrl },
        summary: 'solicitó la verificación de su página', isRead: false, createdAt: pendiente.solicitudVerificacion,
      } }, { upsert: true });
    }
    return pendiente;
  }

  async actualizarVerificacion(id: ObjectId, verificada: boolean, administradorId: string, solicitud?: Date) {
    const pagina = await this.paginas.findOneAndUpdate(
      { _id: id, ...(solicitud ? { solicitudVerificacion: solicitud } : {}) },
      { $unset: { solicitudVerificacion: '' }, $set: {
        isVerified: verificada,
        verificationStatus: verificada ? 'VERIFIED' : 'REJECTED',
        verifiedBy: verificada ? administradorId : null,
        verifiedAt: verificada ? new Date() : null,
      } },
      { returnDocument: 'after' }
    );
    if (pagina) {
      await sincronizarCuentaPagina(this.baseDeDatos, pagina);
      const destinatarios = [pagina.propietarioId];
      if (pagina.propietarioRol === 'USER') destinatarios.push('pagina_' + id.toHexString());
      await this.baseDeDatos.collection('notifications').insertMany(destinatarios.map(userId => ({
        userId, type: 'PAGE_DECISION', refType: 'PAGE', refId: id.toHexString(),
        actorSnapshot: { uid: administradorId, displayName: 'Administración', avatarUrl: null },
        summary: verificada ? 'verificó la página ' + pagina.nombre : 'dejó sin verificación la página ' + pagina.nombre,
        isRead: false, createdAt: new Date(),
      })));
    }
    return pagina;
  }

  async seguir(id: ObjectId, usuarioId: string): Promise<number> {
    try {
      await this.seguimientos.insertOne({ pageId: id, userId: usuarioId, createdAt: new Date() });
      await this.paginas.updateOne({ _id: id }, { $inc: { seguidores: 1 } });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    return (await this.paginas.findOne({ _id: id }))?.seguidores ?? 0;
  }

  async dejarDeSeguir(id: ObjectId, usuarioId: string): Promise<number> {
    const eliminado = await this.seguimientos.deleteOne({ pageId: id, userId: usuarioId });
    if (eliminado.deletedCount) await this.paginas.updateOne({ _id: id, seguidores: { $gt: 0 } }, { $inc: { seguidores: -1 } });
    return (await this.paginas.findOne({ _id: id }))?.seguidores ?? 0;
  }

  registrarAuditoria(datos: { actorId: string; actorRole: string; action: string; targetId: string }) {
    return this.baseDeDatos.collection('auditLogs').insertOne({ ...datos, targetType: 'PAGE', createdAt: new Date() });
  }
}
