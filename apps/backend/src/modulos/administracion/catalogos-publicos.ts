import { Router } from 'express';
import { Db } from 'mongodb';
import { RepositorioAdministracion } from './repositorio';

export function crearRutasCatalogosPublicos(baseDeDatos: Db): Router {
  const rutas = Router();
  const repositorio = new RepositorioAdministracion(baseDeDatos);
  rutas.get('/', async (_solicitud, respuesta, siguiente) => {
    try {
      const catalogos = await repositorio.listarCatalogos();
      return respuesta.json({ catalogos: catalogos.filter((elemento) => elemento.activo && (elemento.tipo !== 'perfil' || elemento.tipoBase === 'STUDENT' || elemento.tipoBase === 'TEACHER')) });
    } catch (error) { return siguiente(error); }
  });
  return rutas;
}
