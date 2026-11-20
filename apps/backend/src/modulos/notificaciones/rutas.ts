import { Router } from 'express';
import { Db } from 'mongodb';
import { Autenticacion } from '../../comun/autenticacion';
import { NotificacionesControlador } from './controladores';
import { NotificacionesRepositorio } from './notificaciones.repositorio';
import { NotificacionesServicio } from './servicios';

export function crearRutasNotificaciones(
  baseDeDatos: Db,
  autenticacion: Autenticacion
): Router {
  const rutas = Router();
  const controlador = new NotificacionesControlador(
    new NotificacionesServicio(new NotificacionesRepositorio(baseDeDatos))
  );

  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);

  rutas.get('/', controlador.listar);
  rutas.post('/leer-todas', controlador.marcarTodasLeidas);
  rutas.post('/:id/leido', controlador.marcarLeida);

  return rutas;
}
