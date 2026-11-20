import { Router } from 'express';
import { Db } from 'mongodb';
import { crearAutenticacion } from '../../comun/autenticacion';
import { ComunidadesControlador } from './controladores';
import { ComunidadesRepositorio } from './repositorio';
import { ComunidadesServicio } from './servicios';

export function crearRutasComunidades(baseDeDatos: Db): Router {
  const rutas = Router();
  const autenticacion = crearAutenticacion(baseDeDatos);
  const controlador = new ComunidadesControlador(new ComunidadesServicio(new ComunidadesRepositorio(baseDeDatos)));

  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);
  rutas.use(autenticacion.autorizarCapacidad('participar_comunidades'));
  rutas.get('/', controlador.listar);
  rutas.post('/', controlador.crear);
  rutas.post('/:id/membresia', controlador.alternarMembresia);
  rutas.get('/:id/solicitudes', controlador.listarSolicitudes);
  rutas.patch('/:id/solicitudes/:usuarioId', controlador.resolverSolicitud);
  rutas.post('/:id/invitaciones', controlador.invitar);
  rutas.post('/:id/chat', controlador.crearChat);

  return rutas;
}
