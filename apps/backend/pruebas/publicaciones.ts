import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { probarApi } from './escenario-http';

probarApi('publicaciones', async ({ db, pedir }) => {
    const paginaId = (await db.collection('pages').insertOne({ nombre: 'Bienestar', descripcion: 'Página institucional',
      propietarioId: 'bienestar', isVerified: true, createdAt: new Date() })).insertedId;
    const basePost = { hubChannel: 'GENERAL', content: 'Actividad del campus' };
    await pedir(401, '', 'GET');
    const adjunto = { ...basePost, content: '', mediaUrls: ['/archivos/imagen.png'] };
    const foto = await pedir(201, 'laura', 'POST', '', adjunto);
    assert.equal(foto.content, '');
    await pedir(400, 'laura', 'POST', '', { ...adjunto, mediaUrls: [] });
    await pedir(400, 'laura', 'POST', '', { ...adjunto, formato: 'PREGUNTA' });
    await pedir(400, 'laura', 'POST', '', { ...adjunto, formato: 'ENCUESTA', opcionesEncuesta: ['A', 'B'] });
    await pedir(400, 'laura', 'PATCH', '/' + foto._id, { mediaUrls: [] });
    const nota = await pedir(201, 'laura', 'POST', '', basePost);
    assert.equal(nota.formato, 'NOTICIA');
    for (const formato of ['ENCUESTA', 'DESCONOCIDO']) await pedir(400, 'laura', 'POST', '', { ...basePost, formato });
    for (const opcionesEncuesta of [['Unica'], ['Si', ' si '], Array(7).fill('X'), ['a', 'b'.repeat(81)]]) {
      await pedir(400, 'laura', 'POST', '', { ...basePost, formato: 'ENCUESTA', opcionesEncuesta });
    }
    await pedir(400, 'laura', 'POST', '', { ...basePost, ubicacion: 'x'.repeat(121) });
    await pedir(400, 'laura', 'POST', '', { ...basePost, formato: 'FORO', opcionesEncuesta: ['A', 'B'] });
    await pedir(400, 'laura', 'POST', '', { ...basePost, formato: 'EVENTO', ubicacion: 'Aula', fechaEvento: '2000-01-01' });
    await pedir(400, 'laura', 'POST', '', { ...basePost, formato: 'EVENTO', fechaEvento: '2100-01-01' });
    const evento = await pedir(201, 'laura', 'POST', '', { ...basePost, formato: 'EVENTO', ubicacion: 'Biblioteca', fechaEvento: '2100-01-01T12:00:00Z' });
    assert.equal(evento.ubicacion, 'Biblioteca');
    await pedir(400, 'laura', 'PUT', '/' + evento._id + '/voto', { opcion: 0 });
    const encuesta = await pedir(201, 'bienestar', 'POST', '', { ...basePost, formato: 'ENCUESTA', opcionesEncuesta: ['Mañana', 'Tarde'] });
    assert.equal(encuesta.authorId, 'bienestar');
    assert.equal(encuesta.pageId, paginaId.toString());
    const ruta = '/' + encuesta._id;
    for (const rol of ['administracion', 'moderador']) {
      await pedir(403, rol, 'POST', '', basePost);
      await pedir(403, rol, 'PUT', ruta + '/voto', { opcion: 1 });
      await pedir(403, rol, 'POST', ruta + '/comentarios', { text: 'no' });
      await pedir(200, rol, 'GET', ruta);
    }
    for (const opcion of [-1, 2, 0.5, '1']) await pedir(400, 'laura', 'PUT', ruta + '/voto', { opcion });
    await Promise.all(Array.from({ length: 6 }, () => pedir(200, 'laura', 'PUT', ruta + '/voto', { opcion: 0 })));
    const cambio = await pedir(200, 'laura', 'PUT', ruta + '/voto', { opcion: 1 });
    assert.deepEqual(cambio, { totales: { '1': 1 }, miOpcion: 1 });
    await pedir(200, 'docente', 'PUT', ruta + '/voto', { opcion: 0 });
    const feed = await pedir(200, 'laura', 'GET');
    const primera = await pedir(200, 'laura', 'GET', '?limite=1');
    assert.ok(primera.siguienteCursor);
    const segunda = await pedir(200, 'laura', 'GET', '?limite=1&cursor=' + primera.siguienteCursor);
    assert.notEqual(primera.publicaciones[0]._id, segunda.publicaciones[0]._id);
    const sondeo = feed.publicaciones.find((p: { _id: string }) => p._id === encuesta._id);
    assert.deepEqual(sondeo.resultadoEncuesta, { totales: { '0': 1, '1': 1 }, miOpcion: 1 });
    const detalle = await pedir(200, 'docente', 'GET', ruta);
    assert.equal(detalle.publicacion.resultadoEncuesta.miOpcion, 0);
    await pedir(200, 'laura', 'PUT', ruta + '/guardada');
    await pedir(200, 'laura', 'PUT', ruta + '/guardada');
    assert.equal((await pedir(200, 'laura', 'GET', '/guardadas')).publicaciones.length, 1);
    assert.equal((await pedir(200, 'docente', 'GET', '/guardadas')).publicaciones.length, 0);
    await pedir(200, 'laura', 'DELETE', ruta + '/guardada');
    await pedir(403, 'laura', 'PATCH', ruta, { content: 'Cambio ajeno' });
    await pedir(403, 'laura', 'DELETE', ruta);
    assert.equal((await pedir(200, 'bienestar', 'PATCH', ruta, { content: 'Nuevo texto' })).content, 'Nuevo texto');
    const foro = await pedir(201, 'laura', 'POST', '', { ...basePost, formato: 'FORO' });
    const pregunta = await pedir(201, 'bienestar', 'POST', '', { ...basePost, formato: 'PREGUNTA' });
    const respuesta = await pedir(201, 'docente', 'POST', '/' + pregunta._id + '/comentarios', { text: 'En biblioteca' });
    const solucion = '/' + pregunta._id + '/comentarios/' + respuesta._id + '/solucion';
    await pedir(403, 'docente', 'POST', solucion);
    await pedir(200, 'bienestar', 'POST', solucion);
    const preguntaLeida = await pedir(200, 'laura', 'GET', '/' + pregunta._id);
    assert.equal(preguntaLeida.comentarios[0].isAcceptedAnswer, true);
    await pedir(201, 'docente', 'POST', '/' + foro._id + '/comentarios', { text: 'Debatamos.' });
    assert.equal((await pedir(200, 'laura', 'GET', '/' + foro._id)).comentarios.length, 1);
    await pedir(403, 'laura', 'POST', '', { ...basePost, hubChannel: 'AVISOS', title: 'Aviso' });
    await pedir(201, 'bienestar', 'POST', '', { ...basePost, hubChannel: 'AVISOS', title: 'Aviso' });
    await pedir(200, 'bienestar', 'DELETE', ruta);
    await pedir(404, 'laura', 'PUT', ruta + '/voto', { opcion: 0 });
    await pedir(404, 'laura', 'GET', ruta);
    assert.equal((await db.collection('posts').findOne({ _id: new ObjectId(encuesta._id) }))?.status, 'DELETED');
 }).catch((error) => { console.error(error); process.exitCode = 1; });
