import { Router } from 'express';
import { Db } from 'mongodb';
import { crearAutenticacion } from '../../comun/autenticacion';
import { entrarComoPagina } from './identidades';
import { PaginasControlador } from './controladores';
import { PaginasRepositorio } from './paginas.repositorio';
import { PaginasServicio } from './servicios';

export function crearRutasPaginas(baseDeDatos: Db): Router {
  const rutas = Router();
  const autenticacion = crearAutenticacion(baseDeDatos);
  const repositorio = new PaginasRepositorio(baseDeDatos);
  const controlador = new PaginasControlador(new PaginasServicio(repositorio));

  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);
  rutas.use(autenticacion.autorizarCapacidad('leer_muro'));
  rutas.get('/', controlador.listar);
  rutas.post('/:id/identidad', autenticacion.autorizar('USER'), async (solicitud, respuesta, siguiente) => {
    try {
      respuesta.json(await entrarComoPagina(baseDeDatos, solicitud.usuario!, solicitud.params.id, solicitud.identidad?.expira));
    } catch (error) { siguiente(error); }
  });
  rutas.post('/', autenticacion.autorizarCapacidad('crear_pagina_institucional'), controlador.crear);
  rutas.patch('/:id', controlador.actualizar);
  rutas.post('/:id/solicitud-verificacion', autenticacion.autorizar('USER'), async (req, res, siguiente) => {
    try { res.json({ pagina: await repositorio.solicitarVerificacion(req.usuario!, req.params.id) }); }
    catch (error) { siguiente(error); }
  });
  rutas.patch('/:id/verificacion', autenticacion.autorizarCapacidad('verificar_paginas'), controlador.cambiarVerificacion);
  rutas.post('/:id/seguir', autenticacion.autorizarCapacidad('seguir_paginas'), controlador.seguir);
  rutas.delete('/:id/seguir', autenticacion.autorizarCapacidad('seguir_paginas'), controlador.dejarDeSeguir);

  return rutas;
}
