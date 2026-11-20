import { Router } from 'express';
import { Db } from 'mongodb';
import { crearAutenticacion } from '../../comun/autenticacion';
import { NotificacionesRepositorio } from '../notificaciones/notificaciones.repositorio';
import { ModeracionControlador } from './controladores';
import { ModeracionRepositorio } from './repositorio';
import { ModeracionServicio } from './servicios';

export function crearRutasModeracion(baseDeDatos: Db): Router {
  const rutas = Router();
  const autenticacion = crearAutenticacion(baseDeDatos);
  const controlador = new ModeracionControlador(
    new ModeracionServicio(
      new ModeracionRepositorio(baseDeDatos),
      new NotificacionesRepositorio(baseDeDatos)
    )
  );

  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);
  rutas.post('/reportes', autenticacion.autorizarCapacidad('reportar_contenido'), controlador.crearReporte);
  rutas.post('/acciones', autenticacion.autorizarCapacidad('moderar_contenido'), controlador.ejecutarAccion);
  rutas.get('/reportes', autenticacion.autorizarCapacidad('revisar_reportes'), controlador.listarReportes);
  rutas.patch('/reportes/:id', autenticacion.autorizarCapacidad('revisar_reportes'), controlador.resolverReporte);

  return rutas;
}
