import 'dotenv/config';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoClient, ObjectId } from 'mongodb';
import comunidad from './comunidad-ejemplo.json';
import { hashearContrasena, verificarContrasena } from '../comun/credenciales';
import { crearSnapshotAutor, type Usuario, type RolUsuario, type TipoCuenta } from '../modulos/usuarios/usuario.modelo';

const clave = '12345678';
const fecha = new Date();
const uri = process.env.MONGODB_URI ?? '';
if (process.env.NODE_ENV === 'production' || !/^mongodb:\/\/(?:localhost|127\.0\.0\.1)(?=[:/]|$)/.test(uri)) {
  throw new Error('La demostración requiere una base MongoDB local de desarrollo.');
}
const cliente = new MongoClient(uri);
const base = cliente.db(process.env.MONGODB_BASE_DATOS || 'polihub');
const usuarios = base.collection<Usuario>('users');
const actores = new Map<string, Usuario>();
const paginas = new Map<string, ObjectId>();
const accesos: string[] = [];
const equipo: string[] = [];
const restablecer = process.argv.includes('--restablecer-ejemplos');

async function cuenta(id: string, username: string, nombre: string, role: RolUsuario, accountType: TipoCuenta, campus = 'MEDELLIN', program = 'Cuenta de prueba') {
  let usuario = await usuarios.findOne({ username });
  const uid = 'local_' + username;
  if (usuario && usuario._id !== uid) throw new Error('El usuario de ejemplo ya está ocupado: ' + username);
  if (!usuario) {
    usuario = {
      _id: uid, email: username + '@polihub.local', emailVerified: false, username, displayName: nombre,
      campus, program, role, accountType, passwordHash: await hashearContrasena(clave), localAuth: true,
      mustChangePassword: false, sessionVersion: 0, status: 'ACTIVE', isVerifiedPoli: accountType === 'PAGE',
      followersCount: 0, followingCount: 0, termsAcceptedAt: { version: '1.0', at: fecha }, updatedAt: fecha, createdAt: fecha,
    };
    await usuarios.insertOne(usuario);
  }
  if (usuario.accountType !== accountType || usuario.role !== role) throw new Error('Revisa el rol de la cuenta de ejemplo ' + username);
  let claveConocida = Boolean(usuario.passwordHash && await verificarContrasena(clave, usuario.passwordHash));
  if (restablecer && (!claveConocida || usuario.mustChangePassword)) {
    await usuarios.updateOne({ _id: uid }, { $inc: { sessionVersion: 1 }, $set: { passwordHash: await hashearContrasena(clave), mustChangePassword: false, localAuth: true, updatedAt: fecha } });
    claveConocida = true;
  }
  actores.set(id, usuario);
  (role === 'USER' ? accesos : equipo).push([usuario.displayName, username, claveConocida ? clave : 'Contraseña personalizada'].join(' | '));
  if (accountType !== 'PAGE') return;
  const pagina = await base.collection('pages').findOneAndUpdate({ propietarioId: uid }, { $setOnInsert: {
    nombre: usuario.displayName, nombreNormalizado: usuario.displayName.toLocaleLowerCase('es'),
    descripcion: program, categoria: id === 'bienestar' ? 'Servicio institucional' : 'Institucional', propietarioId: uid, propietarioRol: 'ADMIN',
    propietarioSnapshot: { username, displayName: usuario.displayName, avatarUrl: null }, avatarUrl: null, portadaUrl: null,
    seguidores: 0, isVerified: true, verificationStatus: 'VERIFIED', verifiedBy: 'local_admin', verifiedAt: fecha, createdAt: fecha,
  } }, { upsert: true, returnDocument: 'after' });
  if (pagina) paginas.set(id, pagina._id);
}
function idEjemplo(tipo: string, id: string) {
  return new ObjectId(createHash('sha256').update('poli-social-demo-v1/' + tipo + '/' + id).digest('hex').slice(0, 24));
}
async function ejecutar() {
  await cliente.connect();
  await cuenta('admin', 'admin', 'Administrador Poli Social Network', 'ADMIN', 'STUDENT');
  await cuenta('moderador', 'moderador', 'Moderador Poli Social Network', 'MODERATOR', 'STUDENT');
  await cuenta('estudiante', 'estudiante', 'Estudiante de prueba', 'USER', 'STUDENT');
  await cuenta('profesor', 'profesor', 'Profesor de prueba', 'USER', 'TEACHER');
  for (const autor of comunidad.autores) {
    const institucional = autor.id === 'bienestar' || autor.id === 'semillero';
    await cuenta(autor.id, autor.id === 'bienestar' ? 'bienestar' : autor.usuario,
      autor.id === 'bienestar' ? 'Bienestar Universitario' : autor.nombre, 'USER',
      institucional ? 'PAGE' : autor.rol === 'docente' ? 'TEACHER' : 'STUDENT', autor.sede, autor.programa);
  }
  for (const [indice, p] of comunidad.publicaciones.entries()) {
    const autor = actores.get(p.autor)!;
    const postId = idEjemplo('publicacion', p.id);
    const createdAt = new Date(fecha.valueOf() - indice * 60000);
    await base.collection('posts').updateOne({ _id: postId }, { $setOnInsert: {
      authorId: autor._id, pageId: paginas.get(p.autor)?.toHexString() ?? null, authorSnapshot: crearSnapshotAutor(autor),
      hubChannel: p.canal, campus: autor.campus, content: p.contenido, title: p.titulo ?? (p.canal === 'GENERAL' ? null : 'Aviso académico'),
      mediaUrls: [], tags: p.etiquetas, mentions: [], marketMeta: p.precio ? { price: p.precio, currency: 'COP', status: 'AVAILABLE' } : null,
      isPinned: !!p.fijado, isEdited: false, likesCount: 0, commentsCount: p.comentarios.length,
      status: 'VISIBLE', createdAt, updatedAt: createdAt,
    } }, { upsert: true });
    for (const comentario of p.comentarios) {
      const persona = actores.get(comentario.autor)!;
      await base.collection('comments').updateOne({ _id: idEjemplo('comentario', comentario.id) }, { $setOnInsert: {
        postId, authorId: persona._id, authorSnapshot: crearSnapshotAutor(persona), text: comentario.texto,
        isAcceptedAnswer: 'solucion' in comentario && !!comentario.solucion, status: 'VISIBLE', createdAt,
      } }, { upsert: true });
    }
  }
  const raiz = resolve(__dirname, '../../../..');
  await writeFile(resolve(raiz, 'usuarios_prueba.txt'), ['Poli Social Network · Demostración local','Nombre | Usuario | Contraseña', ...accesos, '', 'Bienestar y CodePoli tienen acceso directo. Laura puede editar su anuncio de la calculadora.'].join('\n') + '\n');
  const informe = await import('node:fs/promises').then(fs => fs.readFile(resolve(raiz, 'docs/informe-calidad.txt'), 'utf8').catch(() => 'Auditoría en curso.'));
  await writeFile(resolve(raiz, 'credenciales_admin_y_reporte.txt'), ['Acceso local de administración y moderación', 'Nombre | Usuario | Contraseña', ...equipo, '', informe].join('\n') + '\n');
  console.log('Demostración preparada:', actores.size, 'cuentas y', comunidad.publicaciones.length, 'publicaciones de ejemplo.');
}
ejecutar().finally(() => cliente.close()).catch((error) => { console.error(error.message); process.exitCode = 1; });
