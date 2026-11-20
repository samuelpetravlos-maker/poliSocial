import { NextFunction, Request, Response } from 'express';
import { Autenticacion } from '../../comun/autenticacion';
import { CapacidadPoli, tieneCapacidad } from '../../comun/permisos';
import { ErrorHttp } from '../../comun/errores';
import { Usuario } from '../usuarios/usuario.modelo';
import { RepositorioAdministracion, TipoCatalogoAdministrativo } from './repositorio';
import { ServicioAdministracion } from './servicios';

export class ControladoresAdministracion {
  private readonly servicio: ServicioAdministracion;

  constructor(baseDeDatos: ConstructorParameters<typeof RepositorioAdministracion>[0]) {
    this.servicio = new ServicioAdministracion(new RepositorioAdministracion(baseDeDatos));
  }

  private comprobarCapacidad(solicitud: Request, capacidad: CapacidadPoli) {
    if (!solicitud.usuario) throw new ErrorHttp(401, 'Falta el token de autenticación.');
    if (!tieneCapacidad(solicitud.usuario.role, capacidad)) throw new ErrorHttp(403, 'No tienes permisos para realizar esta acción.');
  }

  private ejecutar(operacion: (solicitud: Request) => Promise<unknown>, estado = 200) {
    return async (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
      try {
        const resultado = await operacion(solicitud);
        return respuesta.status(estado).json(resultado);
      } catch (error) {
        return siguiente(error);
      }
    };
  }

  resumen = this.ejecutar(async (solicitud) => {
    this.comprobarCapacidad(solicitud, 'consultar_panel_administrativo');
    return this.servicio.obtenerResumen();
  });

  auditoria = this.ejecutar(async (solicitud) => {
    this.comprobarCapacidad(solicitud, 'consultar_auditoria');
    const accion = typeof solicitud.query.accion === 'string' ? solicitud.query.accion : undefined;
    return { registros: await this.servicio.obtenerAuditoria(solicitud.query.limite, accion) };
  });

  usuarios = this.ejecutar(async (solicitud) => {
    this.comprobarCapacidad(solicitud, 'consultar_cuentas');
    const lista = await this.servicio.listarUsuarios();
    return { usuarios: lista.map((usuario) => {
      const { passwordHash: _passwordHash, ...seguro } = usuario as Usuario;
      return seguro;
    }) };
  });

  catalogos = this.ejecutar(async (solicitud) => {
    this.comprobarCapacidad(solicitud, 'gestionar_catalogos');
    return { catalogos: await this.servicio.listarCatalogos() };
  });

  crearElementoCatalogo = this.ejecutar(async (solicitud) => {
    this.comprobarCapacidad(solicitud, 'gestionar_catalogos');
    const administrador = solicitud.usuario!;
    const tipo = solicitud.params.tipo as TipoCatalogoAdministrativo;
    const elemento = await this.servicio.crearElementoCatalogo(tipo, solicitud.body ?? {}, administrador._id);
    await this.servicio.registrarAccionCatalogo(administrador._id, administrador.role, 'EDIT_CATALOG', tipo.toUpperCase(), elemento.id, { nombre: elemento.nombre, operacion: 'crear' });
    return { elemento };
  }, 201);

  cambiarEstadoCatalogo = this.ejecutar(async (solicitud) => {
    this.comprobarCapacidad(solicitud, 'gestionar_catalogos');
    const administrador = solicitud.usuario!;
    const tipo = solicitud.params.tipo as TipoCatalogoAdministrativo;
    const activo = solicitud.body?.activo;
    if (typeof activo !== 'boolean') throw new ErrorHttp(400, 'Indica si el elemento debe quedar activo.');
    const cambio = await this.servicio.cambiarEstadoCatalogo(tipo, solicitud.params.id, activo, administrador._id);
    await this.servicio.registrarAccionCatalogo(administrador._id, administrador.role, 'EDIT_CATALOG', tipo.toUpperCase(), solicitud.params.id, { activo, operacion: activo ? 'habilitar' : 'inhabilitar' });
    return cambio;
  });
}
