import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { MongoClient, Db } from 'mongodb';
import { crearTokenLocal } from '../src/comun/credenciales';
import { crearAplicacion } from '../src/infraestructura/http/aplicacion';
import type { Usuario } from '../src/modulos/usuarios/usuario.modelo';

type Peticion = (esperado: number, usuario: string, metodo: string, ruta?: string, cuerpo?: object) => Promise<any>;

export async function probarApi(modulo: string, prueba: (escenario: { db: Db; pedir: Peticion }) => Promise<void>) {
  process.env.AUTH_TOKEN_SECRET = randomBytes(32).toString('hex');
  const cliente = new MongoClient(process.env.MONGODB_URI_PRUEBAS || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000 });
  const db = cliente.db('qa_' + modulo + '_' + randomUUID().replaceAll('-', ''));
  const ahora = new Date();
  const cuentas: Usuario[] = ['laura', 'docente', 'moderador', 'administracion', 'bienestar'].map((id) => ({
    _id: id, email: id + '@example.test', emailVerified: true, username: id, displayName: id, campus: 'MEDELLIN',
    program: 'Pruebas', role: id === 'moderador' ? 'MODERATOR' : id === 'administracion' ? 'ADMIN' : 'USER',
    accountType: id === 'bienestar' ? 'PAGE' : id === 'docente' ? 'TEACHER' : 'STUDENT',
    isVerifiedPoli: false, followersCount: 0, followingCount: 0, status: 'ACTIVE',
    termsAcceptedAt: { version: '1', at: ahora }, createdAt: ahora, updatedAt: ahora,
  }));
  await cliente.connect();
  const servidor = crearAplicacion(db).listen(0, '127.0.0.1');
  try {
    await once(servidor, 'listening');
    const direccion = servidor.address();
    assert(direccion && typeof direccion !== 'string');
    const base = 'http://127.0.0.1:' + direccion.port + '/api/';
    await db.collection<Usuario>('users').insertMany(cuentas);
    let solicitudes = 0;
    async function pedir(esperado: number, usuario: string, metodo: string, ruta = '', cuerpo?: object) {
      const r = await fetch(base + (ruta.startsWith('~') ? ruta.slice(1) : modulo + ruta), {
        method: metodo,
        headers: { ...(usuario ? { Authorization: 'Bearer ' + crearTokenLocal(usuario) } : {}), 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const recibido = await r.json();
      assert.equal(r.status, esperado, metodo + ' ' + ruta + ' ' + JSON.stringify(recibido));
      solicitudes++;
      return recibido;
    }
    await prueba({ db, pedir });
    console.log(solicitudes + ' solicitudes HTTP verificadas con MongoDB.');
  } finally {
    servidor.closeAllConnections();
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await db.dropDatabase();
    await cliente.close();
  }
}
