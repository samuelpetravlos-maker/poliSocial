import { Router } from 'express';
import { Db, GridFSBucket, ObjectId } from 'mongodb';
import { finished, pipeline } from 'node:stream/promises';
import { ErrorHttp } from '../../comun/errores';
import { recibirArchivo } from '../archivos/recibir-archivo';
import { prepararArchivo } from '../archivos/servicios';

export function rutasAdjuntosChat(db: Db) {
  const rutas = Router({mergeParams:true});
  const almacen = new GridFSBucket(db,{bucketName:'adjuntosChat'});
  rutas.use(async (req, _res, siguiente) => {
    try {
      const id = (req.params as Record<string,string>).id;
      if (!ObjectId.isValid(id) || !await db.collection('chats').findOne({_id:new ObjectId(id), participantIds:req.usuario!._id}, {projection:{_id:1}})) {
        throw new ErrorHttp(403, 'Solo los integrantes pueden abrir los adjuntos del chat.');
      }
      siguiente();
    } catch(e) { siguiente(e); }
  });
  rutas.post('/', recibirArchivo, async (req, res, siguiente) => {
    try {
      const mime = req.get('Content-Type')?.split(';')[0].toLowerCase() ?? '';
      const archivo = await prepararArchivo(mime, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), req.get('X-Nombre-Archivo'),'publicacion');
      const chatId = (req.params as Record<string,string>).id;
      const flujo = almacen.openUploadStream(archivo.nombreOriginal,{metadata:{chatId,mime:archivo.mime,autor:req.usuario!._id}});
      const completo = finished(flujo);
      flujo.end(archivo.contenido);
      await completo;
      res.status(201).json({url:'/chats/'+chatId+'/adjuntos/'+flujo.id});
    } catch(e) { siguiente(e); }
  });
  rutas.get('/:archivoId', async (req,res,siguiente) => {
    try {
      const {archivoId,id} = req.params as Record<string,string>;
      const archivo = ObjectId.isValid(archivoId) && await almacen.find({_id:new ObjectId(archivoId),'metadata.chatId':id}).next();
      if (!archivo) throw new ErrorHttp(404,'Adjunto no disponible.');
      res.type(String(archivo.metadata?.mime ?? 'application/octet-stream')).set('Cache-Control','private,no-store')
        .set('X-Content-Type-Options','nosniff').set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(archivo.filename));
      await pipeline(almacen.openDownloadStream(archivo._id),res);
    } catch(e) { if (!res.headersSent && !res.destroyed) siguiente(e); }
  });
  return rutas;
}
