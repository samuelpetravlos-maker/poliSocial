import { Db, Document } from 'mongodb';
import { Usuario } from '../usuarios/usuario.modelo';

interface DocumentoCatalogoMongo extends Document {
  _id: string;
  name: string;
  status?: string;
}

export type TipoCatalogoAdministrativo = 'sede' | 'programa' | 'perfil' | 'categoria_pagina';
export type TipoBasePerfil = 'STUDENT' | 'TEACHER' | 'PAGE';

export interface ElementoCatalogoAdministrativo {
  id: string;
  nombre: string;
  activo: boolean;
  tipo: TipoCatalogoAdministrativo;
  ciudad?: string;
  facultad?: string;
  sedes?: string[];
  semestres?: number;
  tipoBase?: TipoBasePerfil;
  integrado?: boolean;
  soloPersonal?: boolean;
}

const SEDES_BASE = [
  { _id: 'MEDELLIN', name: 'Sede Central Medellín', city: 'Medellín', status: 'ACTIVE' },
  { _id: 'URABA', name: 'Centro Regional Urabá', city: 'Apartadó', status: 'ACTIVE' },
  { _id: 'RIONEGRO', name: 'Centro Regional Oriente', city: 'Rionegro', status: 'ACTIVE' },
];
const PROGRAMAS_BASE = [
  { _id: '6910', name: 'Tecnólogo en Desarrollo de Software', faculty: 'Facultad de Ingeniería', campuses: ['MEDELLIN', 'URABA', 'RIONEGRO'], semesters: 6, status: 'ACTIVE' },
  { _id: '6901', name: 'Tecnología en Sistemas', faculty: 'Facultad de Ingeniería', campuses: ['MEDELLIN', 'URABA'], semesters: 6, status: 'ACTIVE' },
  { _id: '1010', name: 'Ingeniería Informática', faculty: 'Facultad de Ingeniería', campuses: ['MEDELLIN', 'RIONEGRO'], semesters: 10, status: 'ACTIVE' },
  { _id: '2101', name: 'Tecnología en Gestión Ambiental', faculty: 'Facultad de Recursos Naturales', campuses: ['MEDELLIN', 'URABA', 'RIONEGRO'], semesters: 6, status: 'ACTIVE' },
];

export class RepositorioAdministracion {
  private readonly usuarios;

  constructor(private readonly baseDeDatos: Db) {
    this.usuarios = baseDeDatos.collection<Usuario>('users');
  }

  async obtenerResumen() {
    const ahora = new Date();
    const [usuariosActivos, estudiantes, profesores, moderadores, administradores, baneosActivos, reportesPendientes, paginasSinVerificar] = await Promise.all([
      this.usuarios.countDocuments({ status: 'ACTIVE' }),
      this.usuarios.countDocuments({ status: 'ACTIVE', role: 'USER', accountType: 'STUDENT' }),
      this.usuarios.countDocuments({ status: 'ACTIVE', role: 'USER', accountType: 'TEACHER' }),
      this.usuarios.countDocuments({ status: 'ACTIVE', role: 'MODERATOR' }),
      this.usuarios.countDocuments({ status: 'ACTIVE', role: 'ADMIN' }),
      this.usuarios.countDocuments({ status: 'ACTIVE', banUntil: { $gt: ahora } }),
      this.baseDeDatos.collection('reports').countDocuments({ status: { $in: ['PENDING', 'REVIEWING'] } }),
      this.baseDeDatos.collection('pages').countDocuments({ solicitudVerificacion: { $type: 'date' } }),
    ]);
    return { usuariosActivos, estudiantes, profesores, moderadores, administradores, baneosActivos, reportesPendientes, paginasSinVerificar };
  }

  async obtenerAuditoria(limite: number, accion?: string) {
    const filtro = accion ? { action: accion } : {};
    const registros = await this.baseDeDatos.collection('auditLogs').find(filtro).sort({ createdAt: -1 }).limit(limite).toArray();
    const ids = [...new Set(registros.map((registro) => String(registro.actorId)))];
    const operadores = await this.usuarios.find({ _id: { $in: ids } }).project({ displayName: 1, username: 1 }).toArray();
    const nombresPorId = new Map(operadores.map((operador) => [operador._id, `${operador.displayName} (@${operador.username})`]));
    return registros.map((registro) => ({ ...registro, actorName: nombresPorId.get(String(registro.actorId)) ?? 'Cuenta eliminada' }));
  }

  listarUsuarios() {
    return this.usuarios.find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).limit(250).toArray();
  }

  async listarCatalogos(): Promise<ElementoCatalogoAdministrativo[]> {
    const sedesBase = this.baseDeDatos.collection<DocumentoCatalogoMongo>('campuses');
    const programasBase = this.baseDeDatos.collection<DocumentoCatalogoMongo>('programs');
    await Promise.all([
      ...SEDES_BASE.map((sede) => sedesBase.updateOne({ _id: sede._id }, { $setOnInsert: sede }, { upsert: true })),
      ...PROGRAMAS_BASE.map((programa) => programasBase.updateOne({ _id: programa._id }, { $setOnInsert: programa }, { upsert: true })),
    ]);
    const perfiles = this.baseDeDatos.collection<DocumentoCatalogoMongo>('accountTypes');
    const perfilesBase: Array<{ _id: string; name: string; baseType: TipoBasePerfil }> = [
      { _id: 'STUDENT', name: 'Estudiante', baseType: 'STUDENT' },
      { _id: 'TEACHER', name: 'Profesor', baseType: 'TEACHER' },
      { _id: 'PAGE', name: 'Página institucional', baseType: 'PAGE' },
    ];
    await Promise.all(perfilesBase.map((perfil) => perfiles.updateOne(
      { _id: perfil._id },
      { $setOnInsert: { ...perfil, status: 'ACTIVE', builtin: true, createdAt: new Date() } },
      { upsert: true },
    )));
    const categoriasPaginas = this.baseDeDatos.collection<DocumentoCatalogoMongo>('pageCategories');
    await Promise.all(['Comunidad', 'Institucional', 'Programa académico', 'Servicio institucional'].map((name) => categoriasPaginas.updateOne(
      { _id: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '_') },
      { $setOnInsert: { name, status: 'ACTIVE', builtin: true, createdAt: new Date() } },
      { upsert: true },
    )));

    const [sedes, programas, tiposCuenta, categorias] = await Promise.all([
      this.baseDeDatos.collection<DocumentoCatalogoMongo>('campuses').find().sort({ name: 1 }).toArray(),
      this.baseDeDatos.collection<DocumentoCatalogoMongo>('programs').find().sort({ name: 1 }).toArray(),
      perfiles.find().sort({ name: 1 }).toArray(),
      this.baseDeDatos.collection<DocumentoCatalogoMongo>('pageCategories').find({ migradaAServicio: { $ne: true } }).sort({ name: 1 }).toArray(),
    ]);
    return [
      ...sedes.map((item) => ({ id: String(item._id), nombre: String(item.name), ciudad: String(item.city ?? ''), activo: item.status !== 'INACTIVE', tipo: 'sede' as const })),
      ...programas.map((item) => ({ id: String(item._id), nombre: String(item.name), facultad: String(item.faculty ?? ''), sedes: Array.isArray(item.campuses) ? item.campuses.map(String) : [], semestres: Number(item.semesters ?? 0), activo: item.status !== 'INACTIVE', tipo: 'programa' as const })),
      ...tiposCuenta.map((item) => ({ id: String(item._id), nombre: String(item.name), tipoBase: item.baseType as TipoBasePerfil, integrado: Boolean(item.builtin), activo: item.status !== 'INACTIVE', tipo: 'perfil' as const })),
      ...categorias.map((item) => ({ id: String(item._id), nombre: String(item.name), soloPersonal: item.soloPersonal ?? item._id === 'servicio_institucional', activo: item.status !== 'INACTIVE', tipo: 'categoria_pagina' as const })),
    ];
  }

  crearElementoCatalogo(tipo: TipoCatalogoAdministrativo, elemento: Record<string, unknown>, creadorId: string) {
    const creadoEn = new Date();
    if (tipo === 'sede') return this.baseDeDatos.collection<DocumentoCatalogoMongo>('campuses').insertOne({
      _id: String(elemento.id), name: String(elemento.nombre), city: String(elemento.ciudad), status: 'ACTIVE', createdAt: creadoEn, createdBy: creadorId,
    });
    if (tipo === 'programa') return this.baseDeDatos.collection<DocumentoCatalogoMongo>('programs').insertOne({
      _id: String(elemento.id), name: String(elemento.nombre), faculty: String(elemento.facultad), campuses: elemento.sedes, semesters: elemento.semestres, status: 'ACTIVE', createdAt: creadoEn, createdBy: creadorId,
    });
    if (tipo === 'perfil') return this.baseDeDatos.collection<DocumentoCatalogoMongo>('accountTypes').insertOne({
      _id: String(elemento.id), name: String(elemento.nombre), baseType: elemento.tipoBase, status: 'ACTIVE', builtin: false, createdAt: creadoEn, createdBy: creadorId,
    });
    return this.baseDeDatos.collection<DocumentoCatalogoMongo>('pageCategories').insertOne({
      _id: String(elemento.id), name: String(elemento.nombre), soloPersonal: elemento.soloPersonal === true, status: 'ACTIVE', createdAt: creadoEn, createdBy: creadorId,
    });
  }

  buscarElementoCatalogo(tipo: TipoCatalogoAdministrativo, id: string) {
    const nombreColeccion = tipo === 'sede' ? 'campuses' : tipo === 'programa' ? 'programs' : tipo === 'perfil' ? 'accountTypes' : 'pageCategories';
    return this.baseDeDatos.collection<DocumentoCatalogoMongo>(nombreColeccion).findOne({ _id: id });
  }

  async buscarNombreCatalogo(tipo: TipoCatalogoAdministrativo, nombre: string) {
    const nombreNormalizado = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
    const nombreColeccion = tipo === 'sede' ? 'campuses' : tipo === 'programa' ? 'programs' : tipo === 'perfil' ? 'accountTypes' : 'pageCategories';
    const nombres = await this.baseDeDatos.collection<DocumentoCatalogoMongo>(nombreColeccion).find().project({ name: 1 }).toArray();
    return nombres.some((elemento) => typeof elemento.name === 'string' && elemento.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim() === nombreNormalizado);
  }

  async existeSedeActiva(id: string) {
    return Boolean(await this.baseDeDatos.collection<DocumentoCatalogoMongo>('campuses').findOne({ _id: id, status: { $ne: 'INACTIVE' } }));
  }

  registrarAccionCatalogo(actorId: string, actorRole: string, accion: string, tipo: string, id: string, detalles: Record<string, unknown>) {
    return this.baseDeDatos.collection('auditLogs').insertOne({ actorId, actorRole, action: accion, targetType: tipo, targetId: id, details: detalles, createdAt: new Date() });
  }

  cambiarEstadoCatalogo(tipo: TipoCatalogoAdministrativo, id: string, activo: boolean, actualizadoPor: string) {
    const nombreColeccion = tipo === 'sede' ? 'campuses' : tipo === 'programa' ? 'programs' : tipo === 'perfil' ? 'accountTypes' : 'pageCategories';
    return this.baseDeDatos.collection<DocumentoCatalogoMongo>(nombreColeccion).updateOne(
      { _id: id },
      { $set: { status: activo ? 'ACTIVE' : 'INACTIVE', updatedAt: new Date(), updatedBy: actualizadoPor } },
    );
  }
}
