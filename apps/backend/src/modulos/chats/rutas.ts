import { Router } from 'express';
import { Db } from 'mongodb';
import { Autenticacion } from '../../comun/autenticacion';
import { BloqueosRepositorio } from '../usuarios/bloqueos.repositorio';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { rutasAdjuntosChat } from './adjuntos';
import { ChatsControlador } from './controladores';
import { ChatsRepositorio } from './chats.repositorio';
import { ChatsServicio } from './servicios';

export function crearRutasChats(baseDeDatos: Db, autenticacion: Autenticacion): Router {
  const rutas = Router();
  const controlador = new ChatsControlador(
    new ChatsServicio(
      new ChatsRepositorio(baseDeDatos),
      new UsuariosRepositorio(baseDeDatos),
      new BloqueosRepositorio(baseDeDatos)
    )
  );

  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);
  rutas.use(autenticacion.autorizarCapacidad('usar_mensajeria'));

  rutas.get('/', controlador.listar);
  rutas.post('/directos', controlador.crearDirecto);
  rutas.post('/grupos', controlador.crearGrupo);
  rutas.use('/:id/adjuntos', rutasAdjuntosChat(baseDeDatos));
  rutas.get('/:id/mensajes', controlador.listarMensajes);
  rutas.post('/:id/mensajes', controlador.enviarMensaje);
  rutas.post('/:id/leido', controlador.marcarLeido);

  return rutas;
}
