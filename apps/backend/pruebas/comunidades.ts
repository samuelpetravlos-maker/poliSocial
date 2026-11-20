import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { ObjectId } from 'mongodb';
import { probarApi } from './escenario-http';

probarApi('comunidades', async ({ db, pedir }) => {
  // Aplica los esquemas versionados sobre la base recién creada para reproducir el entorno de la universidad.
  const esquemas: { nombre: string; opciones: { validator: object } }[] = [];
  const fuente = await readFile(join(__dirname, '../../../configuracion/base_datos/crear_validadores.js'), 'utf8');
  runInNewContext(fuente, { print: () => {}, db: {
    getCollectionNames: () => [],
    createCollection: (nombre: string, opciones: { validator: object }) => esquemas.push({ nombre, opciones }),
  } });
  const existentes = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const { nombre, opciones } of esquemas) {
    if (existentes.has(nombre)) await db.command({ collMod: nombre, ...opciones });
    else await db.createCollection(nombre, opciones);
  }
  const base = { nombre: 'Semillero de física', descripcion: 'Compartimos talleres', categoria: 'SEMILLERO', tipoAcceso: 'LIBRE', sede: 'GLOBAL' };
  await pedir(401, '', 'GET');
  for (const rol of ['moderador', 'administracion']) await pedir(403, rol, 'POST', '', base);
  await pedir(400, 'laura', 'POST', '', { ...base, sede: 'NO_EXISTE' });
  await db.collection<{ _id: string }>('campuses').insertOne({ _id: 'LATERAL', name: 'Campus lateral', city: 'Ciudad', status: 'ACTIVE' } as any);
  const libre = await pedir(201, 'laura', 'POST', '', { ...base, sede: 'LATERAL', crearChatVinculado: true });
  assert.equal(libre.nombreSede, 'Campus lateral');
  await db.collection<{ _id: string }>('campuses').updateOne({ _id: 'LATERAL' }, { $set: { status: 'INACTIVE' } });
  await pedir(400, 'laura', 'POST', '', { ...base, sede: 'LATERAL' });
  const ruta = '/' + libre._id, rutaChat = '~chats/' + libre.chatIdAsociado + '/mensajes';
  assert.ok(libre.chatIdAsociado);
  assert.deepEqual((await pedir(200, 'laura', 'POST', ruta + '/chat')).chat.participantIds, ['laura']);
  await pedir(403, 'docente', 'GET', rutaChat);
  await pedir(403, 'docente', 'POST', ruta + '/chat');
  await pedir(400, 'laura', 'POST', ruta + '/membresia');
  await pedir(200, 'docente', 'POST', ruta + '/membresia');
  await pedir(201, 'docente', 'POST', rutaChat, { text: 'Taller confirmado' });
  assert.equal((await pedir(200, 'laura', 'GET', rutaChat)).mensajes.length, 1);
  await pedir(200, 'docente', 'POST', ruta + '/membresia');
  await pedir(403, 'docente', 'POST', rutaChat, { text: 'Mensaje posterior' });
  const doc = await db.collection('chats').findOne({ _id: new ObjectId(libre.chatIdAsociado) });
  assert.deepEqual(doc?.participantIds, ['laura']);
  assert.equal(doc?.participantsInfo.docente, undefined);
  assert.equal(doc?.unreadCounts.docente, undefined);
  const priv = await pedir(201, 'laura', 'POST', '', { ...base, tipoAcceso: 'INVITACION' });
  const privada = '/' + priv._id;
  const lista = await pedir(200, 'docente', 'GET');
  assert(!lista.comunidades.some((c: { _id: string }) => c._id === priv._id));
  await pedir(403, 'docente', 'POST', privada + '/membresia');
  await pedir(403, 'docente', 'POST', privada + '/invitaciones', { usuarioId: 'laura' });
  await pedir(404, 'laura', 'POST', privada + '/invitaciones', { usuarioId: 'moderador' });
  await pedir(201, 'laura', 'POST', privada + '/invitaciones', { usuarioId: 'docente' });
  assert((await pedir(200, 'docente', 'GET')).comunidades.find((c: { _id: string }) => c._id === priv._id).invitacionPendiente);
  await pedir(200, 'docente', 'POST', privada + '/membresia');
  await pedir(403, 'docente', 'POST', privada + '/chat');
  const chat = (await pedir(201, 'laura', 'POST', privada + '/chat')).chat;
  const par = await Promise.all([pedir(200, 'laura', 'POST', privada + '/chat'), pedir(200, 'docente', 'POST', privada + '/chat')]);
  assert(par.every((r) => r.chat._id === chat._id));
  assert.equal(await db.collection('chats').countDocuments({ comunidadId: priv._id }), 1);
  const aprob = await pedir(201, 'laura', 'POST', '', { ...base, tipoAcceso: 'APROBACION', crearChatVinculado: true });
  const abierta = '/' + aprob._id;
  assert((await pedir(200, 'docente', 'POST', abierta + '/membresia')).solicitudPendiente);
  await pedir(403, 'docente', 'GET', abierta + '/solicitudes');
  const solicitudes = await pedir(200, 'laura', 'GET', abierta + '/solicitudes');
  assert.deepEqual(Object.keys(solicitudes.usuarios[0]).sort(), ['_id', 'displayName', 'username']);
  await pedir(200, 'laura', 'PATCH', abierta + '/solicitudes/docente', { aprobar: false });
  await pedir(404, 'laura', 'PATCH', abierta + '/solicitudes/docente', { aprobar: true });
  await pedir(200, 'docente', 'POST', abierta + '/membresia');
  await pedir(200, 'laura', 'PATCH', abierta + '/solicitudes/docente', { aprobar: true });
  const asociado = await pedir(200, 'docente', 'POST', abierta + '/chat');
  assert(asociado.chat.participantIds.includes('docente'));
}).catch((error) => { console.error(error); process.exitCode = 1; });
