import { Router } from 'express';
import { Db } from 'mongodb';
import { Autenticacion } from '../../comun/autenticacion';
import { ControladoresAdministracion } from './controladores';
import { ControladorCuentas } from './controlador-cuentas';

export function crearRutasAdministracion(baseDeDatos: Db, autenticacion: Autenticacion): Router {
  const rutas = Router();
  const cuentas = new ControladorCuentas(baseDeDatos);
  const controladores = new ControladoresAdministracion(baseDeDatos);
  rutas.use(autenticacion.autenticarToken, autenticacion.cargarUsuario);

  rutas.get('/resumen', controladores.resumen);
  rutas.get('/auditoria', controladores.auditoria);
  rutas.get('/usuarios', controladores.usuarios);
  rutas.get('/catalogos', controladores.catalogos);
  rutas.post('/catalogos/:tipo', controladores.crearElementoCatalogo);
  rutas.patch('/catalogos/:tipo/:id/estado', controladores.cambiarEstadoCatalogo);

  rutas.patch('/catalogos/categoria_pagina/:id/acceso', autenticacion.autorizar('ADMIN'), async (req, res, siguiente) => {
    try {
      const soloPersonal = req.body?.soloPersonal;
      if (typeof soloPersonal !== 'boolean') { res.status(400).json({ mensaje: 'Indica el permiso de creación.' }); return; }
      const id = req.params.id;
      const resultado = await baseDeDatos.collection<{ _id: string; soloPersonal?: boolean }>('pageCategories').updateOne({ _id: id }, { $set: { soloPersonal } });
      if (!resultado.matchedCount) { res.status(404).json({ mensaje: 'Categoría no encontrada.' }); return; }
      await baseDeDatos.collection('auditLogs').insertOne({ actorId: req.usuario!._id, actorRole: 'ADMIN', action: 'EDIT_CATALOG', targetType: 'CATEGORIA_PAGINA', targetId: id, details: { soloPersonal }, createdAt: new Date() });
      res.json({ soloPersonal });
    } catch (error) { siguiente(error); }
  });
  rutas.post('/usuarios', cuentas.crearCuenta);
  rutas.patch('/usuarios/:id/perfil', cuentas.cambiarPerfil);
  rutas.patch('/usuarios/:id/baneo', cuentas.aplicarBaneo);
  rutas.delete('/usuarios/:id/baneo', cuentas.retirarBaneo);
  rutas.post('/usuarios/:id/restablecer-contrasena', cuentas.restablecerContrasena);
  rutas.patch('/usuarios/:id/rol', cuentas.cambiarRol);
  rutas.patch('/usuarios/:id/estado', cuentas.cambiarEstado);
  return rutas;
}
