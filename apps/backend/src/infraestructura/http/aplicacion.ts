import cors from 'cors';
import express, { Express } from 'express';
import path from 'node:path';
import { Db } from 'mongodb';
import { crearRutas } from './rutas';
import { manejarErrores, rutaNoEncontrada } from './manejador-errores';
import { obtenerOrigenWebPermitido } from '../../comun/configuracion';

export function crearAplicacion(baseDeDatos: Db): Express {
  const aplicacion = express();
  aplicacion.use(cors({ origin: obtenerOrigenWebPermitido() }));
  aplicacion.use('/archivos', express.static(path.resolve(process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'archivos_subidos')), {
    fallthrough: false, index: false,
    setHeaders: (respuesta) => {
      respuesta.setHeader('X-Content-Type-Options', 'nosniff');
      respuesta.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    },
  }));
  aplicacion.use(express.json({ limit: '1mb' }));
  aplicacion.use('/api', crearRutas(baseDeDatos));
  aplicacion.use(rutaNoEncontrada);
  aplicacion.use(manejarErrores);
  return aplicacion;
}
