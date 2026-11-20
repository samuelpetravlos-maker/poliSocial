import { ObjectId } from 'mongodb';
import { ErrorHttp } from '../../comun/errores';
import { tieneCapacidad } from '../../comun/permisos';
import { Usuario } from '../usuarios/usuario.modelo';
import { PaginaColeccion } from './colecciones';
import { PaginasRepositorio } from './paginas.repositorio';

export class PaginasServicio {
  constructor(private readonly repositorio: PaginasRepositorio) {}

  listar(usuario: Usuario) {
    return this.repositorio.listar(usuario._id, usuario.paginaId, usuario.role === 'ADMIN');
  }

  async crear(usuario: Usuario, entrada: Record<string, unknown>) {
    if (usuario.role !== 'USER' || usuario.accountType === 'PAGE') {
      throw new ErrorHttp(403, 'Crea esta página desde tu perfil personal.');
    }
    const nombre = typeof entrada.nombre === 'string' ? entrada.nombre.trim() : '';
    const descripcion = typeof entrada.descripcion === 'string' ? entrada.descripcion.trim() : '';
    const categoria = typeof entrada.categoria === 'string' ? entrada.categoria.trim() : 'Comunidad';
    if (nombre.length < 3 || nombre.length > 80) throw new ErrorHttp(400, 'El nombre debe tener entre 3 y 80 caracteres.');
    if (descripcion.length > 500) throw new ErrorHttp(400, 'La descripción puede tener hasta 500 caracteres.');
    if (!await this.repositorio.categoriaActiva(categoria)) throw new ErrorHttp(400, 'Selecciona una categoría permitida para tu cuenta.');
    const nombreNormalizado = nombre.toLocaleLowerCase('es');
    if (await this.repositorio.nombreExiste(nombreNormalizado)) throw new ErrorHttp(409, 'Ya existe una página con ese nombre.');

    const ahora = new Date();
    const pagina: Omit<PaginaColeccion, '_id'> = {
      nombre,
      nombreNormalizado,
      descripcion,
      categoria: categoria.slice(0, 50),
      propietarioId: usuario._id,
      propietarioRol: usuario.role,
      propietarioSnapshot: { username: usuario.username, displayName: usuario.displayName, avatarUrl: usuario.avatarUrl ?? null },
      avatarUrl: null,
      portadaUrl: null,
      seguidores: 0,
      isVerified: false,
      verificationStatus: 'UNREQUESTED',
      verifiedBy: null,
      verifiedAt: null,
      createdAt: ahora,
    };
    return this.repositorio.crear(pagina);
  }

  async actualizar(usuario: Usuario, id: string, entrada: Record<string, unknown>) {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Página no encontrada.');
    const pagina = await this.repositorio.buscarPorId(id);
    if (!pagina) throw new ErrorHttp(404, 'Página no encontrada.');
    const administraPaginas = tieneCapacidad(usuario.role, 'gestionar_paginas');
    const gestionaPaginaPropia = tieneCapacidad(usuario.role, 'gestionar_pagina_propia') && (pagina.propietarioId === usuario._id || usuario.paginaId === id);
    if (!administraPaginas && !gestionaPaginaPropia) throw new ErrorHttp(403, 'Solo el propietario o administración puede editar esta página.');

    const cambios: Partial<PaginaColeccion> = {};
    if (entrada.nombre !== undefined) {
      const nombre = typeof entrada.nombre === 'string' ? entrada.nombre.trim() : '';
      if (nombre.length < 3 || nombre.length > 80) throw new ErrorHttp(400, 'El nombre debe tener entre 3 y 80 caracteres.');
      const nombreNormalizado = nombre.toLocaleLowerCase('es');
      if (await this.repositorio.nombreExiste(nombreNormalizado, pagina._id)) throw new ErrorHttp(409, 'Ya existe una página con ese nombre.');
      cambios.nombre = nombre;
      cambios.nombreNormalizado = nombreNormalizado;
    }
    if (entrada.descripcion !== undefined) {
      if (typeof entrada.descripcion !== 'string' || entrada.descripcion.length > 500) throw new ErrorHttp(400, 'La descripción permite hasta 500 caracteres.');
      cambios.descripcion = entrada.descripcion.trim();
    }
    if (entrada.categoria !== undefined) {
      if (typeof entrada.categoria !== 'string' || entrada.categoria.trim().length > 50) throw new ErrorHttp(400, 'Categoría no válida.');
      const categoria = entrada.categoria.trim();
      if (categoria !== pagina.categoria && !await this.repositorio.categoriaActiva(categoria, usuario.role === 'ADMIN')) throw new ErrorHttp(400, 'Selecciona una categoría permitida para tu cuenta.');
      cambios.categoria = categoria;
    }
    for (const campo of ['avatarUrl', 'portadaUrl'] as const) {
      const valor = entrada[campo];
      if (valor === undefined) continue;
      if (valor !== null && (typeof valor !== 'string' || valor.length > 500 || !/^https?:\/\//.test(valor))) {
        throw new ErrorHttp(400, `El campo ${campo} debe ser una URL válida.`);
      }
      cambios[campo] = valor;
    }
    const actualizada = await this.repositorio.actualizarDatos(pagina._id, cambios);
    if (!actualizada) throw new ErrorHttp(404, 'Página no encontrada.');
    return actualizada;
  }

  async cambiarVerificacion(usuario: Usuario, id: string, valor: unknown, solicitud?: unknown) {
    if (!tieneCapacidad(usuario.role, 'verificar_paginas')) throw new ErrorHttp(403, 'Solo administración puede verificar páginas.');
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Página no encontrada.');
    if (typeof valor !== 'boolean') throw new ErrorHttp(400, 'Indica si la página queda verificada.');
    let fecha: Date | undefined;
    if (solicitud !== undefined) {
      if (typeof solicitud !== 'string' || !Number.isFinite(Date.parse(solicitud))) throw new ErrorHttp(400, 'Solicitud no válida.');
      fecha = new Date(solicitud);
    }
    const pagina = await this.repositorio.actualizarVerificacion(new ObjectId(id), valor, usuario._id, fecha);
    if (!pagina && fecha) throw new ErrorHttp(409, 'Otro administrador ya atendió esta solicitud. Actualiza la lista.');
    if (!pagina) throw new ErrorHttp(404, 'Página no encontrada.');
    await this.repositorio.registrarAuditoria({ actorId: usuario._id, actorRole: usuario.role, action: valor ? 'VERIFY_PAGE' : 'REJECT_PAGE', targetId: id });
    return pagina;
  }

  async seguir(usuario: Usuario, id: string) {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Página no encontrada.');
    const paginaId = new ObjectId(id);
    const pagina = await this.repositorio.buscarPorId(id);
    if (!pagina) throw new ErrorHttp(404, 'Página no encontrada.');
    if (pagina.propietarioId === usuario._id || usuario.paginaId === id) throw new ErrorHttp(400, 'No puedes seguir tu propia página.');
    const seguidores = await this.repositorio.seguir(paginaId, usuario._id);
    return { siguiendo: true, seguidores };
  }

  async dejarDeSeguir(usuario: Usuario, id: string) {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Página no encontrada.');
    const seguidores = await this.repositorio.dejarDeSeguir(new ObjectId(id), usuario._id);
    return { siguiendo: false, seguidores };
  }
}
