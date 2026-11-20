import 'dotenv/config';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Server } from 'socket.io';
import sharp from 'sharp';
import { crearAplicacion } from '../src/infraestructura/http/aplicacion';
import { configurarEventos } from '../src/infraestructura/tiempo-real/eventos';
import { hashearContrasena } from '../src/comun/credenciales';

async function ejecutar() {
  const cliente = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {serverSelectionTimeoutMS:5000});
  const carpeta = await mkdtemp(path.join(tmpdir(),'poli-qa-navegador-'));
  const bd = cliente.db('poli_qa_interfaz_' + randomUUID().replaceAll('-',''));
  const origen = new URL(process.env.POLI_QA_WEB || 'http://localhost:3000').origin;
  process.env.ORIGEN_WEB = origen;
  process.env.UPLOADS_DIR = carpeta;
  process.env.AUTH_TOKEN_SECRET = randomUUID() + randomUUID();
  const servidor = createServer(crearAplicacion(bd));
  const io = new Server(servidor,{cors:{origin:origen}});
  configurarEventos(io,bd);
  io.on('connection', s => {
    console.log('Canal en vivo conectado para ' + s.data.usuarioId);
    s.once('escribiendo', () => console.log('Indicador recibido desde ' + s.data.usuarioId));
    s.onAnyOutgoing((evento) => { if (evento === 'escribiendo' && !s.data.indicadorObservado) {
      s.data.indicadorObservado = true; console.log('Indicador entregado a ' + s.data.usuarioId);
    } });
  });
  try {
    await cliente.connect();
    const clave = randomUUID();
    const foto = path.join(carpeta, 'biblioteca.png');
    await sharp({ create: { width: 80, height: 60, channels: 3, background: '#376052' } }).png().toFile(foto);
    const passwordHash = await hashearContrasena(clave);
    for (const [username,role,accountType,nombre] of [
      ['admin','ADMIN','STUDENT','Administración QA'], ['moderador','MODERATOR','STUDENT','Moderación QA'],
      ['estudiante','USER','STUDENT','Estudiante QA'], ['bienestar','USER','PAGE','Bienestar QA'],
    ]) {
      await bd.collection<{_id:string;[key:string]:unknown}>('users').insertOne({
        _id:'local_' + username, username, role, accountType, localAuth:true, passwordHash,
        displayName:nombre, status:'ACTIVE', campus:'MEDELLIN', program:'Programa QA',
        email:username + '@elpoli.edu.co', emailVerified:true, isVerifiedPoli:false, followersCount:0,followingCount:0,
        termsAcceptedAt:{version:'1',at:new Date()}, createdAt:new Date(), updatedAt:new Date(),
      });
    }
    await bd.collection<{_id:string;[k:string]:unknown}>('pageCategories').insertOne({_id:'grupos',name:'Grupo de estudio',status:'ACTIVE'});
    await bd.collection('pages').insertOne({
      avatarUrl:'data:image/png;base64,' + (await sharp(foto).png().toBuffer()).toString('base64'), nombre:'Bienestar QA', nombreNormalizado:'bienestar qa', propietarioId:'local_bienestar', propietarioRol:'ADMIN',
      descripcion:'Acompañamiento estudiantil', categoria:'Institucional', isVerified:true, seguidores:0, createdAt:new Date(),
    });
    servidor.listen(0,'127.0.0.1');
    await once(servidor,'listening');
    const destino = servidor.address();
    if (!destino || typeof destino === 'string') throw new Error('No se pudo asignar un puerto a la API temporal.');
    const resultado = await promisify(execFile)(process.execPath,['--test','pruebas/interfaz.mjs'],{
      cwd:path.resolve(__dirname,'../../web'), windowsHide:true, timeout:180000,
      env:{...process.env,POLI_QA_WEB:origen,POLI_QA_CLAVE:clave,POLI_QA_API:'http://127.0.0.1:' + destino.port + '/api',
        POLI_QA_PAGINA:'Grupo de cálculo QA', POLI_QA_CONTACTO:'Bienestar QA', POLI_QA_FOTO:foto},
    });
    process.stdout.write(resultado.stdout);
  } finally {
    await io.close(); if (servidor.listening) servidor.close();
    await bd.dropDatabase(); await cliente.close(); await rm(carpeta,{recursive:true,force:true});
  }
}
ejecutar().catch(error => {console.error(error.stdout || error.message); process.exitCode=1;});

