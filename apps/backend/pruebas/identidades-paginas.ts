import { strict as assert } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import type { CreateCollectionOptions } from 'mongodb';
import { MongoClient } from 'mongodb';
import { crearAplicacion } from '../src/infraestructura/http/aplicacion';
import { crearTokenLocal, hashearContrasena } from '../src/comun/credenciales';
import { Usuario } from '../src/modulos/usuarios/usuario.modelo';

// Usa una base exclusiva con nombre aleatorio, sin leer la configuración de la aplicación.
async function probar() {
  const cliente = new MongoClient(process.env.MONGODB_URI_QA ?? 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 4000 });
  const db = cliente.db('qa_identidades_' + randomUUID().replace(/-/g, ''));
  process.env.AUTH_TOKEN_SECRET = randomBytes(40).toString('hex');
  let conectado = false;
  const servidor = crearAplicacion(db).listen(0, '127.0.0.1');
  try {
    await once(servidor, 'listening');
    await cliente.connect();
    conectado = true;
    const colecciones: [string, CreateCollectionOptions][] = [];
    const crearValidadores = await readFile(resolve(__dirname, '../../../configuracion/base_datos/crear_validadores.js'), 'utf8');
    runInNewContext(crearValidadores, {
      print: () => {},
      db: {
        getCollectionNames: () => [],
        createCollection: (nombre: string, opciones: CreateCollectionOptions) => colecciones.push([nombre, opciones]),
      },
    });
    for (const [nombre, opciones] of colecciones) await db.createCollection(nombre, opciones);
    await db.collection('pages').createIndex({ nombreNormalizado: 1 }, { unique: true });
    await db.collection('pageFollows').createIndex({ pageId: 1, userId: 1 }, { unique: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    const direccion = servidor.address();
    assert(direccion && typeof direccion === 'object');
    const origen = `http://127.0.0.1:${direccion.port}/api`;
    let numero = 0;
    async function api(metodo: string, ruta: string, token: string, esperado: number, cuerpo?: object) {
      const respuesta = await fetch(origen + ruta, {
        method: metodo, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const datos = await respuesta.json() as Record<string, any>;
      assert.equal(respuesta.status, esperado, `${metodo} ${ruta} — ${datos.mensaje || respuesta.status}`);
      numero++;
      return datos;
    }
    const hash = await hashearContrasena('claveDeQA1');
    const cuentas = db.collection<Usuario>('users');
    for (const [nombre, rol] of [['ana','USER'], ['luis','USER'], ['mod','MODERATOR'], ['admin','ADMIN'], ['admin2','ADMIN']] as const) {
      const ahora = new Date();
      await cuentas.insertOne({
        _id: nombre, username: nombre, email: nombre+'@qa.invalid', displayName: nombre,
        campus: 'MEDELLIN', program: 'Universidad', role: rol, accountType: 'STUDENT',
        emailVerified: false, isVerifiedPoli: false, followersCount: 0, followingCount: 0,
        localAuth: true, passwordHash: hash, status: 'ACTIVE',
        termsAcceptedAt: { version:'1', at: ahora }, createdAt: ahora, updatedAt: ahora,
      });
    }
    const [ana,luis,mod,admin] = ['ana','luis','mod','admin'].map(id => crearTokenLocal(id));
    await api('GET','/catalogos','',200);
    const { pagina } = await api('POST','/paginas',ana,201,{ nombre:'Club de robótica', categoria: 'Institucional' });
    assert.equal(pagina.isVerified,false);
    assert.equal(pagina.verificationStatus,'UNREQUESTED');
    const ruta = '/paginas/' + pagina._id;
    await api('POST',ruta+'/identidad',luis,403);
    await api('POST',ruta+'/identidad',admin,403);
    const {token: delegado} = await api('POST',ruta+'/identidad',ana,200);
    const solicitud = ruta + '/solicitud-verificacion';
    await api('POST', solicitud, luis, 403);
    const pendiente = await api('POST', solicitud, delegado, 200);
    await api('POST', solicitud, ana, 200);
    for (const nombre of ['admin','admin2']) {
      const avisos = await api('GET','/notificaciones',crearTokenLocal(nombre),200);
      assert.equal(avisos.notificaciones.filter((n: any) => n.refId === pagina._id && n.type === 'PAGE_VERIFICATION').length, 1);
    }
    const acceso = '/administracion/catalogos/categoria_pagina/servicio_institucional/acceso';
    await api('PATCH',acceso,mod,403,{soloPersonal:false});
    await api('POST','/paginas',ana,400,{nombre:'Servicio privado',categoria:'Servicio institucional'});
    await api('PATCH',ruta,delegado,400,{categoria:'Servicio institucional'});
    await api('PATCH',acceso,admin,200,{soloPersonal:false});
    await api('POST','/paginas',ana,201,{nombre:'Grupo de estudio',categoria:'Servicio institucional'});
    await api('PATCH',acceso,admin,200,{soloPersonal:true});
    const perfil = await api('GET','/usuarios/mi-perfil',delegado,200);
    assert.equal(perfil._id,'pagina_'+pagina._id);
    assert.equal(perfil.displayName,pagina.nombre);
    assert.equal(perfil.accountType,'PAGE');
    assert(!perfil.passwordHash);
    await api('POST','/publicaciones',ana,403,{ pageId:pagina._id, content:'Identidad equivocada',hubChannel:'GENERAL' });
    const publicacion = await api('POST','/publicaciones',delegado,201,{ content:'Reunión del club', hubChannel:'GENERAL' });
    assert.equal(publicacion.authorId,perfil._id);
    assert.equal(publicacion.pageId,pagina._id);
    await api('PATCH','/publicaciones/'+publicacion._id,ana,403,{content:'Edición personal'});
    await api('PATCH','/publicaciones/'+publicacion._id,delegado,200,{content:'Nueva hora'});
    const comentario = await api('POST','/publicaciones/'+publicacion._id+'/comentarios',delegado,201,{text:'En el laboratorio'});
    assert.equal(comentario.authorId,perfil._id);
    assert.equal((await api('GET','/publicaciones?vista=respondidas',delegado,200)).publicaciones[0]._id,publicacion._id);
    assert.equal((await api('GET','/publicaciones?vista=propias',ana,200)).publicaciones.length,0);
    await api('POST',ruta+'/seguir',luis,200);
    assert.equal((await api('GET','/publicaciones?vista=siguiendo',luis,200)).publicaciones[0]._id,publicacion._id);
    await api('DELETE',ruta+'/seguir',luis,200);
    assert.equal((await api('GET','/publicaciones?vista=siguiendo',luis,200)).publicaciones.length,0);
    const rutaClave='/autenticacion/mi-contrasena';
    const clave={passwordActual:'claveDeQA1', passwordNueva:'nuevaClave2'};
    await api('PATCH',rutaClave,delegado,403,clave);
    await api('PATCH',rutaClave,mod,403,clave);
    await api('PATCH',rutaClave,admin,403,clave);
    await api('PATCH',ruta+'/verificacion',mod,403,{verificada:true});
    await api('PATCH',ruta+'/verificacion',ana,403,{verificada:true});
    await api('PATCH',ruta+'/verificacion',admin,200,{verificada:true, solicitud:pendiente.pagina.solicitudVerificacion});
    await api('PATCH',ruta+'/verificacion',crearTokenLocal('admin2'),409,{verificada:false, solicitud:pendiente.pagina.solicitudVerificacion});
    assert.equal((await api('GET','/usuarios/mi-perfil',delegado,200)).isVerifiedPoli,true);
    await api('PATCH',ruta+'/verificacion',admin,200,{verificada:false});
    assert.equal((await api('GET','/usuarios/mi-perfil',delegado,200)).isVerifiedPoli,false);
    const actualizado = await api('PATCH','/usuarios/mi-perfil',delegado,200,{displayName:'Club de sensores'});
    assert.equal(actualizado.passwordHash,undefined);
    assert.equal((await api('GET','/usuarios/mi-perfil',delegado,200)).displayName,'Club de sensores');
    await api('DELETE','/publicaciones/'+publicacion._id,delegado,200);
    const datos = { username:'biblioteca', displayName:'Biblioteca central', email:'biblioteca@qa.invalid', password:'claveDeQA1', campus:'MEDELLIN', role:'USER', accountType:'PAGE' };
    await api('POST','/administracion/usuarios',ana,403,datos);
    await api('POST','/administracion/usuarios',mod,403,{...datos,role:'ADMIN'});
    const alta=await api('POST','/administracion/usuarios',mod,201,datos);
    assert.equal(alta.usuario.isVerifiedPoli,false);
    await api('POST','/administracion/usuarios',mod,409,datos);
    const {token:biblioteca,usuario:cuenta} = await api('POST','/autenticacion/sesion','',200,{identificador:datos.username,password:datos.password});
    assert(cuenta.paginaId && !cuenta.paginaDelegada);
    const aviso = await api('POST','/publicaciones',biblioteca,201,{hubChannel:'GENERAL',content:'Horario de atención'});
    assert.equal(aviso.authorId,cuenta._id);
    assert.equal(aviso.pageId,cuenta.paginaId);
    await api('PATCH',rutaClave,biblioteca,200,clave);
    await api('GET','/usuarios/mi-perfil',biblioteca,401);
    await api('POST','/autenticacion/sesion','',200,{identificador:datos.username,password:clave.passwordNueva});
    const adminPagina = await api('POST','/administracion/usuarios',admin,201,{...datos,verificada:true,categoria:'Servicio institucional',username:'cafeteria',email:'cafeteria@qa.invalid',displayName:'Cafetería central'});
    assert.equal(adminPagina.usuario.isVerifiedPoli,true);
    const ordinaria = await api('POST','/administracion/usuarios',admin,201,{...datos,username:'archivo',email:'archivo@qa.invalid',displayName:'Archivo institucional'});
    assert.equal(ordinaria.usuario.isVerifiedPoli,false);
    await api('POST','/administracion/usuarios',mod,403,{...datos,username:'reservado',email:'reservado@qa.invalid',displayName:'Servicio reservado',verificada:true});
    for (const identidad of [ana,delegado]) {
      for (const avatarUrl of ['https://qa.invalid/uno.webp','https://qa.invalid/dos.webp',null]) {
        assert.equal((await api('PATCH','/usuarios/mi-perfil',identidad,200,{avatarUrl})).avatarUrl,avatarUrl);
      }
    }
    await api('PATCH','/usuarios/mi-perfil',admin,403,{displayName:'Intento'});
    await api('PATCH','/usuarios/mi-perfil',mod,403,{displayName:'Intento'});
    await api('POST','/paginas',delegado,403,{nombre:'Página anidada', categoria:'Comunidad'});
    await api('POST','/paginas',ana,400,{nombre:'Página inválida', categoria:'Categoría ajena'});
    await cuentas.updateOne({_id:'ana'},{$set:{status:'SUSPENDED'}});
    await api('GET','/usuarios/mi-perfil',delegado,403);
    await cuentas.updateOne({_id:'ana'},{$set:{status:'ACTIVE'}});
    await cuentas.updateOne({_id:perfil._id},{$set:{banUntil:new Date(Date.now()+3600000)}});
    await api('GET','/usuarios/mi-perfil',delegado,403);
    await cuentas.updateOne({_id:perfil._id},{$unset:{banUntil:''}});
    const personal = await api('GET','/usuarios/mi-perfil',ana,200);
    assert.equal(personal._id,'ana');
    await api('PATCH',rutaClave,ana,200,clave);
    await api('GET','/usuarios/mi-perfil',delegado,401);
    console.info(`${numero} solicitudes HTTP de identidad y permisos correctas.`);
  } finally {
    servidor.close();
    try { if (conectado) await db.dropDatabase(); } finally { await cliente.close(); }
  }
}
probar().catch(error => { console.error(error); process.exitCode = 1; });
