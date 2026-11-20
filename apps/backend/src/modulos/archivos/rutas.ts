import { Router } from 'express';
import { Db } from 'mongodb';
import { crearAutenticacion } from '../../comun/autenticacion';
import { AlmacenamientoLocal } from '../../infraestructura/archivos/almacenamiento-local';
import { ArchivosControlador } from './controladores';
import { ArchivosServicio } from './servicios';
import { recibirArchivo } from './recibir-archivo';

export function crearRutasArchivos(baseDeDatos: Db): Router {
  const rutas = Router();
  const autenticacion = crearAutenticacion(baseDeDatos);
  const controlador = new ArchivosControlador(
    new ArchivosServicio(new AlmacenamientoLocal(process.env.UPLOADS_DIR))
  );

  rutas.post(
    '/',
    autenticacion.autenticarToken,
    autenticacion.cargarUsuario,
    autenticacion.autorizarCapacidad('publicar_contenido'),
    recibirArchivo,
    controlador.subir
  );
  return rutas;
}
