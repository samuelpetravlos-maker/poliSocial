import { Router } from 'express';
import { Db } from 'mongodb';
import { pipeline } from 'node:stream/promises';
import { Autenticacion } from '../../comun/autenticacion';
import { recibirArchivo } from '../archivos/recibir-archivo';
import { EstadosServicio } from './servicios';

export function crearRutasEstados(db: Db, autenticacion: Autenticacion) {
  const rutas = Router();
  const servicio = new EstadosServicio(db);
  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario, autenticacion.autorizarCapacidad('leer_muro'));
  rutas.get('/', async (req, res, siguiente) => {
    try { res.json(await servicio.listar(req.usuario!)); } catch (error) { siguiente(error); }
  });
  rutas.post('/', autenticacion.autorizarCapacidad('publicar_contenido'), recibirArchivo, async (req, res, siguiente) => {
    try {
      const archivo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      res.status(201).json(await servicio.crear(req.usuario!, req.get('Content-Type')?.split(';')[0].toLowerCase() ?? '', archivo, req.get('X-Nombre-Archivo')));
    } catch (error) { siguiente(error); }
  });
  rutas.get('/:id/archivo', async (req, res, siguiente) => {
    try {
      const { flujo, mime } = await servicio.leer(req.usuario!, req.params.id);
      res.type(mime).set('Cache-Control','private, no-store').set('X-Content-Type-Options','nosniff');
      await pipeline(flujo, res);
    } catch (error) { if (!res.headersSent && !res.destroyed) siguiente(error); }
  });
  rutas.patch('/:id/retirar', autenticacion.autorizarCapacidad('gestionar_contenido_propio'), async (req, res, siguiente) => {
    try { await servicio.retirar(req.usuario!, req.params.id); res.sendStatus(204); } catch (error) { siguiente(error); }
  });
  return rutas;
}
