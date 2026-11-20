import { Db, ObjectId, WithId } from 'mongodb';
import { ErrorHttp } from '../../comun/errores';
import { crearTokenLocal } from '../../comun/credenciales';
import { Usuario } from '../usuarios/usuario.modelo';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { PaginaColeccion } from './colecciones';

const idDelegado = (pagina: WithId<PaginaColeccion>) => `pagina_${pagina._id.toHexString()}`;

function camposDePagina(pagina: WithId<PaginaColeccion>) {
  return {
    displayName: pagina.nombre,
    bio: pagina.descripcion.slice(0, 200),
    avatarUrl: pagina.avatarUrl ?? null,
    isVerifiedPoli: pagina.isVerified,
    paginaId: pagina._id.toHexString(),
  };
}

async function paginaDelTitular(db: Db, titular: Usuario, id: string) {
  if (!ObjectId.isValid(id) || titular.role !== 'USER' || titular.accountType === 'PAGE') {
    throw new ErrorHttp(403, 'Solo el titular puede usar esta página.');
  }
  const pagina = await db.collection<PaginaColeccion>('pages').findOne({ _id: new ObjectId(id), propietarioId: titular._id });
  if (!pagina) throw new ErrorHttp(403, 'Solo el titular puede usar esta página.');
  return pagina;
}

/** Las operaciones sociales reciben la identidad activa. El token conserva al titular para revalidar sus permisos. */
export async function resolverIdentidadSocial(db: Db, titular: Usuario, id?: string): Promise<Usuario> {
  if (id) {
    const pagina = await paginaDelTitular(db, titular, id);
    const cuenta = await db.collection<Usuario>('users').findOne({ _id: idDelegado(pagina), role: 'USER', accountType: 'PAGE', paginaDelegada: true });
    if (!cuenta || cuenta.status !== 'ACTIVE' || (cuenta.banUntil && cuenta.banUntil > new Date())) {
      throw new ErrorHttp(403, 'La página está inhabilitada o suspendida.');
    }
    return { ...cuenta, ...camposDePagina(pagina), followersCount: pagina.seguidores };
  }
  if (titular.paginaDelegada) throw new ErrorHttp(403, 'Accede con tu perfil personal y selecciona la página.');
  if (titular.accountType !== 'PAGE') return titular;
  const pagina = await db.collection<PaginaColeccion>('pages').findOne({ propietarioId: titular._id });
  if (!pagina) throw new ErrorHttp(409, 'La cuenta institucional no tiene una página vinculada.');
  return { ...titular, ...camposDePagina(pagina), followersCount: pagina.seguidores };
}

export async function entrarComoPagina(db: Db, titular: Usuario, id: string, expiracionTitular?: number) {
  const pagina = await paginaDelTitular(db, titular, id);
  const activoId = idDelegado(pagina);
  const ahora = new Date();
  const cuenta: Usuario = {
    _id: activoId, ...camposDePagina(pagina), paginaDelegada: true,
    username: `pag.${pagina._id.toHexString()}`, email: `${activoId}@paginas.invalid`, emailVerified: false,
    campus: titular.campus, program: 'Página de la comunidad', role: 'USER', accountType: 'PAGE',
    localAuth: false, followersCount: 0, followingCount: 0, status: 'ACTIVE',
    termsAcceptedAt: titular.termsAcceptedAt, createdAt: ahora, updatedAt: ahora,
  };
  await db.collection<Usuario>('users').updateOne({ _id: activoId }, { $setOnInsert: cuenta }, { upsert: true });
  const activo = await resolverIdentidadSocial(db, titular, id);
  // Las publicaciones anteriores guardaban la cuenta personal en authorId junto con pageId.
  const migrados = await db.collection('posts').updateMany({ pageId: id, authorId: titular._id }, { $set: { authorId: activoId } });
  if (migrados.modifiedCount) await new UsuariosRepositorio(db).propagarSnapshot(activo);
  return { token: crearTokenLocal(titular._id, titular.sessionVersion ?? 0, id, expiracionTitular) };
}

export async function sincronizarCuentaPagina(db: Db, pagina: WithId<PaginaColeccion>) {
  const cuenta = await db.collection<Usuario>('users').findOneAndUpdate(
    { _id: { $in: [pagina.propietarioId, idDelegado(pagina)] }, accountType: 'PAGE' },
    { $set: { ...camposDePagina(pagina), updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (cuenta) await new UsuariosRepositorio(db).propagarSnapshot(cuenta);
}
