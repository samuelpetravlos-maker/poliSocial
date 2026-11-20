import { Db, GridFSBucket, ObjectId } from 'mongodb';
import { finished } from 'node:stream/promises';
import { ErrorHttp } from '../../comun/errores';
import { Usuario } from '../usuarios/usuario.modelo';
import { BloqueosRepositorio } from '../usuarios/bloqueos.repositorio';
import { prepararArchivo } from '../archivos/servicios';

export const VIGENCIA_ESTADO_MS = 24 * 60 * 60 * 1000;
interface DatosEstado {
  autorId: string;
  autor: string;
  avatar: string | null;
  mime: string;
  segundos: number;
  vence: Date;
  retirado: boolean;
}
interface ArchivoEstado { _id: ObjectId; metadata: DatosEstado; uploadDate: Date }

function presentar(archivo: ArchivoEstado, usuario: Usuario) {
  const { autor, avatar, mime, segundos, vence, autorId } = archivo.metadata;
  return { id: archivo._id.toHexString(), autor, avatar, mime, segundos, vence, propio: autorId === usuario._id };
}

export class EstadosServicio {
  private readonly archivos;
  private readonly almacen;
  private readonly bloqueos;
  constructor(db: Db) {
    this.archivos = db.collection<ArchivoEstado>('estados.files');
    this.almacen = new GridFSBucket(db, { bucketName: 'estados' });
    this.bloqueos = new BloqueosRepositorio(db);
  }

  private async visibles(usuario: Usuario) {
    const excluidos = await this.bloqueos.idsConBloqueo(usuario._id);
    return { 'metadata.vence': { $gt: new Date() }, 'metadata.retirado': false, 'metadata.autorId': { $nin: excluidos } };
  }

  async listar(usuario: Usuario) {
    const filtro = await this.visibles(usuario);
    const archivos = await this.archivos.find(filtro).sort({ uploadDate: -1 }).limit(100).toArray();
    return archivos.map(archivo => presentar(archivo, usuario));
  }

  async crear(usuario: Usuario, mime: string, datos: Buffer, nombre: unknown) {
    const preparado = await prepararArchivo(mime, datos, nombre, 'estado');
    const ahora = new Date();
    const metadata: DatosEstado = {
      autorId: usuario._id, autor: usuario.displayName, avatar: usuario.avatarUrl ?? null,
      mime: preparado.mime, segundos: preparado.duracion ?? 15,
      vence: new Date(ahora.getTime() + VIGENCIA_ESTADO_MS), retirado: false,
    };
    const flujo = this.almacen.openUploadStream(preparado.nombreOriginal, { metadata });
    const terminar = finished(flujo);
    flujo.end(preparado.contenido);
    await terminar;
    return presentar({ _id: flujo.id, uploadDate: ahora, metadata }, usuario);
  }

  async leer(usuario: Usuario, id: string) {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Estado no disponible.');
    const archivo = await this.archivos.findOne({ _id: new ObjectId(id), ...await this.visibles(usuario) });
    if (!archivo) throw new ErrorHttp(404, 'El estado venció o ya no está disponible.');
    return { mime: archivo.metadata.mime, flujo: this.almacen.openDownloadStream(archivo._id) };
  }

  async retirar(usuario: Usuario, id: string) {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Estado no disponible.');
    const resultado = await this.archivos.updateOne({
      _id: new ObjectId(id), 'metadata.autorId': usuario._id, 'metadata.retirado': false
    }, { $set: { 'metadata.retirado': true } });
    if (!resultado.matchedCount) throw new ErrorHttp(404, 'Estado propio no disponible.');
  }
}
