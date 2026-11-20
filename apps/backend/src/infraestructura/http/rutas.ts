import { Router } from 'express';
import { Db } from 'mongodb';
import { crearAutenticacion } from '../../comun/autenticacion';
import { crearRutasUsuarios } from '../../modulos/usuarios/rutas';
import { crearRutasPublicaciones } from '../../modulos/publicaciones/rutas';
import { crearRutasChats } from '../../modulos/chats/rutas';
import { crearRutasNotificaciones } from '../../modulos/notificaciones/rutas';
import { crearRutasAutenticacion } from '../../modulos/autenticacion/rutas';
import { crearRutasAdministracion } from '../../modulos/administracion/rutas';
import { crearRutasArchivos } from '../../modulos/archivos/rutas';
import { crearRutasEstados } from '../../modulos/estados/rutas';
import { crearRutasPaginas } from '../../modulos/paginas/rutas';
import { crearRutasComunidades } from '../../modulos/comunidades/rutas';
import { crearRutasModeracion } from '../../modulos/moderacion/rutas';
import { crearRutasCatalogosPublicos } from '../../modulos/administracion/catalogos-publicos';

export function crearRutas(baseDeDatos: Db): Router {
  const rutas = Router();
  const autenticacion = crearAutenticacion(baseDeDatos);

  rutas.get('/salud', (_solicitud, respuesta) => respuesta.json({ estado: 'disponible' }));
  rutas.use('/catalogos', crearRutasCatalogosPublicos(baseDeDatos));
  rutas.use('/autenticacion', crearRutasAutenticacion(baseDeDatos));
  rutas.use('/archivos', crearRutasArchivos(baseDeDatos));
  rutas.use('/estados', crearRutasEstados(baseDeDatos, autenticacion));
  rutas.use('/paginas', crearRutasPaginas(baseDeDatos));
  rutas.use('/comunidades', crearRutasComunidades(baseDeDatos));
  rutas.use('/moderacion', crearRutasModeracion(baseDeDatos));
  rutas.use('/administracion', crearRutasAdministracion(baseDeDatos, autenticacion));
  rutas.use('/usuarios', crearRutasUsuarios(baseDeDatos, autenticacion));
  rutas.use('/publicaciones', crearRutasPublicaciones(baseDeDatos, autenticacion));
  rutas.use('/chats', crearRutasChats(baseDeDatos, autenticacion));
  rutas.use('/notificaciones', crearRutasNotificaciones(baseDeDatos, autenticacion));
  return rutas;
}
