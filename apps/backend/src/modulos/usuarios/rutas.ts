import { Router } from 'express';
import { Db } from 'mongodb';
import { Autenticacion } from '../../comun/autenticacion';
import { NotificacionesRepositorio } from '../notificaciones/notificaciones.repositorio';
import { BloqueosRepositorio } from './bloqueos.repositorio';
import { SeguidoresRepositorio } from './seguidores.repositorio';
import { UsuariosControlador } from './controladores';
import { UsuariosRepositorio } from './usuarios.repositorio';
import { UsuariosServicio } from './servicios';

export function crearRutasUsuarios(baseDeDatos: Db, autenticacion: Autenticacion): Router {
  const rutas = Router();
  const controlador = new UsuariosControlador(
    new UsuariosServicio(
      new UsuariosRepositorio(baseDeDatos),
      new SeguidoresRepositorio(baseDeDatos),
      new BloqueosRepositorio(baseDeDatos),
      new NotificacionesRepositorio(baseDeDatos)
    )
  );

  rutas.post('/', autenticacion.autenticarToken, controlador.registrar);

  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);
  rutas.use(autenticacion.autorizarCapacidad('leer_muro'));

  rutas.get('/mi-perfil', controlador.miPerfil);
  rutas.get('/sugerencias', controlador.sugerencias);
  rutas.get('/', controlador.buscar);
  rutas.get('/:id', controlador.obtenerPerfil);
  rutas.get('/:id/seguidores', controlador.seguidores);
  rutas.get('/:id/seguidos', controlador.seguidos);
  rutas.use(autenticacion.autorizarCapacidad('gestionar_perfil_propio'));
  rutas.patch('/mi-perfil', controlador.actualizarPerfil);
  rutas.post('/:id/seguir', controlador.seguir);
  rutas.delete('/:id/seguir', controlador.dejarDeSeguir);
  rutas.post('/:id/bloqueo', controlador.bloquear);
  rutas.delete('/:id/bloqueo', controlador.desbloquear);

  return rutas;
}
