import { RepositorioAdministracion } from './repositorio';
import { ErrorHttp } from '../../comun/errores';
import { ElementoCatalogoAdministrativo, TipoBasePerfil, TipoCatalogoAdministrativo } from './repositorio';

const TIPOS_CATALOGO: readonly TipoCatalogoAdministrativo[] = ['sede', 'programa', 'perfil', 'categoria_pagina'];

function texto(datos: Record<string, unknown>, campo: string, maximo: number): string {
  const valor = typeof datos[campo] === 'string' ? datos[campo].trim() : '';
  if (!valor || valor.length > maximo) throw new ErrorHttp(400, `El campo ${campo} es obligatorio y admite hasta ${maximo} caracteres.`);
  return valor;
}

export class ServicioAdministracion {
  constructor(private readonly repositorio: RepositorioAdministracion) {}

  obtenerResumen() {
    return this.repositorio.obtenerResumen();
  }

  obtenerAuditoria(limiteSolicitado: unknown, accion?: string) {
    const valor = Number(limiteSolicitado ?? 50);
    const limite = Number.isInteger(valor) ? Math.min(Math.max(valor, 1), 100) : 50;
    return this.repositorio.obtenerAuditoria(limite, accion);
  }

  listarUsuarios() {
    return this.repositorio.listarUsuarios();
  }

  listarCatalogos() {
    return this.repositorio.listarCatalogos();
  }

  async crearElementoCatalogo(tipo: TipoCatalogoAdministrativo, datos: Record<string, unknown>, creadorId: string) {
    if (!TIPOS_CATALOGO.includes(tipo)) throw new ErrorHttp(404, 'El tipo de catálogo no existe.');
    const nombre = texto(datos, 'nombre', tipo === 'perfil' ? 80 : 100);
    if (await this.repositorio.buscarNombreCatalogo(tipo, nombre)) throw new ErrorHttp(409, 'Ya existe un elemento con ese nombre, incluso si está inhabilitado. Puedes volver a habilitarlo desde la lista.');
    const id = (typeof datos.id === 'string' && datos.id.trim() ? datos.id.trim() : nombre)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
    if (!id) throw new ErrorHttp(400, 'Ingresa un código válido para el registro.');
    if (await this.repositorio.buscarElementoCatalogo(tipo, id)) throw new ErrorHttp(409, 'Ya existe un registro con ese código. Puedes volver a habilitarlo desde la lista.');

    const elemento: Record<string, unknown> = { id, nombre };
    if (tipo === 'categoria_pagina') elemento.soloPersonal = datos.soloPersonal === true;
    if (tipo === 'sede') {
      elemento.ciudad = texto(datos, 'ciudad', 80);
    } else if (tipo === 'programa') {
      elemento.facultad = texto(datos, 'facultad', 100);
      const sedes = Array.isArray(datos.sedes) ? [...new Set(datos.sedes.filter((sede): sede is string => typeof sede === 'string'))] : [];
      if (!sedes.length || !(await Promise.all(sedes.map((sede) => this.repositorio.existeSedeActiva(sede)))).every(Boolean)) {
        throw new ErrorHttp(400, 'Selecciona al menos una sede activa para el programa.');
      }
      const semestres = Number(datos.semestres);
      if (!Number.isInteger(semestres) || semestres < 1 || semestres > 20) throw new ErrorHttp(400, 'Los semestres deben ser un número entre 1 y 20.');
      elemento.sedes = sedes;
      elemento.semestres = semestres;
    } else if (tipo === 'perfil') {
      const tipoBase = datos.tipoBase;
      if (!['STUDENT', 'TEACHER', 'PAGE'].includes(String(tipoBase))) throw new ErrorHttp(400, 'Selecciona un perfil base válido.');
      elemento.tipoBase = tipoBase as TipoBasePerfil;
    }

    await this.repositorio.crearElementoCatalogo(tipo, elemento, creadorId);
    return { id, nombre, tipo, activo: true, ...(elemento.ciudad ? { ciudad: elemento.ciudad } : {}), ...(elemento.facultad ? { facultad: elemento.facultad, sedes: elemento.sedes, semestres: elemento.semestres } : {}), ...(elemento.tipoBase ? { tipoBase: elemento.tipoBase } : {}) } as ElementoCatalogoAdministrativo;
  }

  async cambiarEstadoCatalogo(tipo: TipoCatalogoAdministrativo, id: string, activo: boolean, actualizadoPor: string) {
    if (!TIPOS_CATALOGO.includes(tipo)) throw new ErrorHttp(404, 'El tipo de catálogo no existe.');
    const existente = await this.repositorio.buscarElementoCatalogo(tipo, id);
    if (!existente) throw new ErrorHttp(404, 'No se encontró el elemento del catálogo.');
    if (tipo === 'perfil' && existente.builtin && id === 'PAGE' && !activo) throw new ErrorHttp(400, 'El tipo de perfil Página institucional es necesario para administrar páginas y no se puede inhabilitar.');
    await this.repositorio.cambiarEstadoCatalogo(tipo, id, activo, actualizadoPor);
    return { id, activo };
  }

  registrarAccionCatalogo(actorId: string, actorRole: string, accion: string, tipo: string, id: string, detalles: Record<string, unknown>) {
    return this.repositorio.registrarAccionCatalogo(actorId, actorRole, accion, tipo, id, detalles);
  }
}
