import { Router } from 'express';
import { Db } from 'mongodb';
import { Autenticacion } from '../../comun/autenticacion';
import { NotificacionesRepositorio } from '../notificaciones/notificaciones.repositorio';
import { BloqueosRepositorio } from '../usuarios/bloqueos.repositorio';
import { SeguidoresRepositorio } from '../usuarios/seguidores.repositorio';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { ComentariosRepositorio } from './comentarios.repositorio';
import { PublicacionesControlador } from './controladores';
import { PublicacionesRepositorio } from './publicaciones.repositorio';
import { PublicacionesServicio } from './servicios';
import { ReaccionesRepositorio } from './reacciones.repositorio';
import { VotosRepositorio } from './votos.repositorio';
import { PaginasRepositorio } from '../paginas/paginas.repositorio';

export function crearRutasPublicaciones(
  baseDeDatos: Db,
  autenticacion: Autenticacion
): Router {
  const rutas = Router();
  const controlador = new PublicacionesControlador(
    new PublicacionesServicio(
      new PublicacionesRepositorio(baseDeDatos),
      new ReaccionesRepositorio(baseDeDatos),
      new ComentariosRepositorio(baseDeDatos),
      new SeguidoresRepositorio(baseDeDatos),
      new BloqueosRepositorio(baseDeDatos),
      new UsuariosRepositorio(baseDeDatos),
      new NotificacionesRepositorio(baseDeDatos),
      new PaginasRepositorio(baseDeDatos),
      new VotosRepositorio(baseDeDatos)
    )
  );

  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);
  rutas.use(autenticacion.autorizarCapacidad('leer_muro'));

  rutas.get('/', controlador.listar);
  rutas.get('/guardadas', autenticacion.autorizarCapacidad('reaccionar'), controlador.listarGuardadas);
  rutas.put('/:id/guardada', autenticacion.autorizarCapacidad('reaccionar'), controlador.guardarReferencia);
  rutas.delete('/:id/guardada', autenticacion.autorizarCapacidad('reaccionar'), controlador.guardarReferencia);
  rutas.get('/:id', controlador.detalle);
  rutas.post('/', autenticacion.autorizarCapacidad('publicar_contenido'), controlador.crear);
  rutas.patch('/:id', autenticacion.autorizarCapacidad('gestionar_contenido_propio'), controlador.editar);
  rutas.delete('/:id', autenticacion.autorizarCapacidad('gestionar_contenido_propio'), controlador.eliminar);
  rutas.put('/:id/voto', autenticacion.autorizarCapacidad('reaccionar'), controlador.votar);
  rutas.post('/:id/likes', autenticacion.autorizarCapacidad('reaccionar'), controlador.darLike);
  rutas.delete('/:id/likes', autenticacion.autorizarCapacidad('reaccionar'), controlador.quitarLike);
  rutas.post('/:id/reacciones', autenticacion.autorizarCapacidad('reaccionar'), controlador.reaccionar);
  rutas.post('/:id/comentarios', autenticacion.autorizarCapacidad('comentar'), controlador.comentar);
  rutas.delete('/:id/comentarios/:comentarioId', autenticacion.autorizarCapacidad('comentar'), controlador.eliminarComentario);
  rutas.post('/:id/comentarios/:comentarioId/solucion', autenticacion.autorizarCapacidad('comentar'), controlador.marcarSolucion);

  return rutas;
}
