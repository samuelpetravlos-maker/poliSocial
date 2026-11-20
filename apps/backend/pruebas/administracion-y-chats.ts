import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';
import { crearAplicacion } from '../src/infraestructura/http/aplicacion';
import { crearTokenLocal } from '../src/comun/credenciales';
import type { Usuario } from '../src/modulos/usuarios/usuario.modelo';

async function probar() {
  const nombre = 'qa_gestion_' + randomUUID().replaceAll('-', '');
  const uri = 'mongodb://127.0.0.1:27017/' + nombre;
  const cliente = new MongoClient(uri, {serverSelectionTimeoutMS: 5000});
  const db = cliente.db(nombre);
  process.env.AUTH_TOKEN_SECRET = randomBytes(32).toString('hex');
  await cliente.connect();
  const servidor = crearAplicacion(db).listen(0, '127.0.0.1');
  try {
    await once(servidor, 'listening');
    for (const script of ['crear_validadores', 'datos_iniciales', 'crear_indices']) {
      execFileSync('mongosh', [uri, '--quiet', '--norc', '--file', resolve(__dirname, '../../../configuracion/base_datos/' + script + '.js')]);
    }
    const direccion = servidor.address();
    assert(direccion && typeof direccion !== 'string');
    const base = 'http://127.0.0.1:' + direccion.port + '/api';
    let llamadas = 0;
    async function pedir(estado: number, quien: string, metodo: string, ruta: string, cuerpo?: object) {
      const r = await fetch(base + ruta, {method: metodo, headers: {
        'Content-Type':'application/json', ...(quien ? {Authorization: 'Bearer ' + crearTokenLocal(quien)} : {}),
      }, body: cuerpo && JSON.stringify(cuerpo)});
      const datos = await r.json();
      assert.equal(r.status, estado, [metodo,ruta,JSON.stringify(datos)].join(' ')); llamadas++;
      return datos;
    }
    const ahora = new Date();
    const cuentas: Usuario[] = ['local_admin','admin_dos','mod','alumno','docente','tercero'].map(_id => ({
      _id, role: _id.includes('admin') ? 'ADMIN' : _id === 'mod' ? 'MODERATOR' : 'USER',
      username: _id, displayName: 'Cuenta ' + _id, email: _id+'@example.test', emailVerified:false, accountType:_id==='docente'?'TEACHER':'STUDENT',
      campus:'MEDELLIN',program:'Pruebas',isVerifiedPoli:false,followersCount:0,followingCount:0,status:'ACTIVE',
      termsAcceptedAt:{version:'1',at:ahora},createdAt:ahora,updatedAt:ahora,
    }));
    await db.collection<Usuario>('users').insertMany(cuentas);
    for (const rol of ['alumno', 'mod']) await pedir(403,rol,'GET','/administracion/catalogos');
    await pedir(401,'','GET','/administracion/resumen');
    await pedir(200,'local_admin','GET','/administracion/resumen');
    await pedir(201,'local_admin','POST','/administracion/catalogos/programa',{nombre:'Matemáticas',facultad:'Ciencias',sedes:['MEDELLIN'],semestres:8});
    await pedir(409,'local_admin','POST','/administracion/catalogos/programa',{nombre:'Matematicas'});
    await pedir(200,'local_admin','PATCH','/administracion/catalogos/programa/matematicas/estado',{activo:false});
    assert.equal((await pedir(200,'','GET','/catalogos')).catalogos.some((c:any)=>c.id==='matematicas'),false);
    await pedir(200,'local_admin','PATCH','/administracion/catalogos/programa/matematicas/estado',{activo:true});
    assert.ok((await pedir(200,'','GET','/catalogos')).catalogos.some((c:any)=>c.id==='matematicas'));
    await pedir(400,'local_admin','PATCH','/administracion/usuarios/local_admin/estado',{activo:false});
    await pedir(403,'admin_dos','PATCH','/administracion/usuarios/local_admin/estado',{activo:false});
    await pedir(403,'admin_dos','PATCH','/administracion/usuarios/docente/rol',{role:'ADMIN'});
    await pedir(200,'local_admin','PATCH','/administracion/usuarios/admin_dos/estado',{activo:false});
    assert.ok(await db.collection<Usuario>('users').findOne({_id:'admin_dos', status:'DELETED'}));
    await pedir(200,'local_admin','PATCH','/administracion/usuarios/admin_dos/estado',{activo:true});
    const directo = await pedir(201,'alumno','POST','/chats/directos',{usuarioId:'docente'});
    assert.equal((await pedir(201,'docente','POST','/chats/directos',{usuarioId:'alumno'}))._id,directo._id);
    await pedir(403,'mod','GET','/chats');
    await pedir(404,'alumno','POST','/chats/directos',{usuarioId:'mod'});
    await pedir(400,'alumno','POST','/chats/grupos',{groupName:'Grupo',participantIds:['mod','docente']});
    await pedir(403,'tercero','GET','/chats/'+directo._id+'/mensajes');
    const mensajes = '/chats/'+directo._id+'/mensajes';
    const mensaje = {text:'Nos vemos en la biblioteca',clientMsgId:randomUUID()};
    const primero = await pedir(201,'alumno','POST',mensajes,mensaje);
    assert.equal((await pedir(201,'alumno','POST',mensajes,mensaje))._id,primero._id);
    const avisosChat = (await pedir(200,'docente','GET','/notificaciones')).notificaciones;
    assert.equal(avisosChat.filter((n:any) => n.type === 'CHAT_MESSAGE' && n.refId === directo._id).length, 1);
    assert.equal((await pedir(200,'docente','GET',mensajes)).mensajes.length,1);
    await pedir(200,'docente','POST','/chats/'+directo._id+'/leido');
    assert.equal((await pedir(200,'docente','GET','/chats')).noLeidosTotales,0);
    const archivo = await fetch(base+'/chats/'+directo._id+'/adjuntos', {method:'POST',headers:{
      Authorization:'Bearer '+crearTokenLocal('alumno'), 'Content-Type':'application/pdf', 'X-Nombre-Archivo':'prueba.pdf'
    },body:'%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n'});
    assert.equal(archivo.status,201); llamadas++;
    const {url} = await archivo.json();
    await pedir(201,'alumno','POST',mensajes,{mediaUrl:url});
    const descarga = await fetch(base+url,{headers:{Authorization:'Bearer '+crearTokenLocal('docente')}});
    assert.equal(descarga.status,200); assert.ok((await descarga.text()).startsWith('%PDF')); llamadas++;
    await pedir(403,'tercero','GET',url);
    await pedir(401,'','GET',url);
    await pedir(400,'docente','POST',mensajes,{mediaUrl:url});
    const grupo = await pedir(201,'alumno','POST','/chats/grupos',{groupName:'Biblioteca',participantIds:['docente','tercero']});
    await pedir(201,'tercero','POST','/chats/'+grupo._id+'/mensajes',{text:'Llegué'});
    const post = await pedir(201,'alumno','POST','/publicaciones',{hubChannel:'GENERAL',content:'Información del campus'});
    const reporte = {targetType:'POST',targetId:post._id,reason:'OTRO',details:'Revisión de QA'};
    await pedir(201,'docente','POST','/moderacion/reportes',reporte);
    await pedir(200,'docente','POST','/moderacion/reportes',reporte);
    assert.equal((await pedir(200,'mod','GET','/notificaciones')).notificaciones.filter((n:any)=>n.type==='CONTENT_REPORTED').length,1);
    const lista = await pedir(200,'mod','GET','/moderacion/reportes');
    await pedir(200,'mod','PATCH','/moderacion/reportes/'+lista.reportes[0]._id,{status:'RESOLVED',accion:'OCULTAR'});
    assert.ok(!(await pedir(200,'alumno','GET','/publicaciones')).publicaciones.some((p:any)=>p._id===post._id));
    await pedir(200,'local_admin','PATCH','/administracion/usuarios/alumno/baneo',{reason:'OTRO'});
    const alumno = await db.collection<Usuario>('users').findOne({_id:'alumno'});
    assert.ok(alumno?.banUntil && Math.abs((alumno.banUntil.valueOf()-Date.now())/86400000-30)<0.01);
    assert.ok((await pedir(200,'local_admin','GET','/administracion/auditoria')).registros.length >= 5);
    console.log(llamadas + ' peticiones correctas con índices y validadores activos. Administración, chat y moderación.');
  } finally {
    await new Promise<void>(ok => servidor.close(()=>ok()));
    await db.dropDatabase();
    await cliente.close();
  }
}
probar().catch(e=>{ console.error(e);process.exitCode=1; });
