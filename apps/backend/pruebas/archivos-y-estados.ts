import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { MongoClient, ObjectId } from 'mongodb';
import { ffmpegPath } from 'ffmpeg-ffprobe-static';
import sharp from 'sharp';
import { crearTokenLocal } from '../src/comun/credenciales';
import { crearAplicacion } from '../src/infraestructura/http/aplicacion';
import { prepararArchivo } from '../src/modulos/archivos/servicios';

const ejecutar = promisify(execFile);
const foto = sharp({create: {width: 80, height: 60, channels: 3, background: '#568758'}});
const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');

test('normaliza imágenes de uso común a un formato visible en el navegador', async t => {
  for (const [ext, mime, imagen] of [
    ['png','png',foto.clone().png()], ['jpg','jpeg',foto.clone().jpeg()], ['webp','webp',foto.clone().webp()],
    ['gif','gif',foto.clone().gif()], ['tiff','tiff',foto.clone().tiff()], ['avif','avif',foto.clone().avif()],
  ] as const) await t.test(ext, async () => {
    const salida = await prepararArchivo('image/' + mime, await imagen.toBuffer(), 'foto.' + ext);
    assert.equal(salida.mime,'image/webp');
    assert.equal((await sharp(salida.contenido).metadata()).width,80);
  });
  await t.test('SVG se convierte en un mapa de bits', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"><rect width="9" height="9" fill="green"/></svg>');
    assert.equal((await prepararArchivo('image/svg+xml',svg,'facultad.svg')).mime,'image/webp');
  });
  for (const [extension, mime] of [['heic','image/heic'],['bmp','image/bmp'],['ico','image/vnd.microsoft.icon']]) {
    await t.test(extension, async () => {
      const muestra = await readFile(path.join(__dirname,'muestras','foto.' + extension));
      const salida = await prepararArchivo(mime,muestra,'foto.' + extension);
      assert.equal(salida.mime, 'image/webp');
      assert.ok((await sharp(salida.contenido).metadata()).width);
    });
  }
});

test('videos reales, compresión y límites medidos desde el servidor', async t => {
  const carpeta = await mkdtemp(path.join(os.tmpdir(),'poli-qa-video-'));
  try {
    for (const segundos of [2,120,121]) await t.test(segundos + ' segundos', async () => {
      const ruta = path.join(carpeta, segundos + '.mp4');
      const fuente = segundos === 2 ? 'testsrc2=size=320x240:rate=25' : 'color=size=32x32:rate=1';
      await ejecutar(process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg',['-nostdin','-v','error','-f','lavfi','-i',fuente,'-t',String(segundos),'-c:v','libx264','-threads','1','-crf','0',ruta],{windowsHide:true});
      const datos = await readFile(ruta);
      if (segundos > 120) return assert.rejects(prepararArchivo('video/mp4',datos,'video.mp4','estado'), /2 minutos/);
      const salida = await prepararArchivo('video/mp4',datos,'video.mp4','estado');
      assert.equal(salida.duracion,segundos);
      if (segundos === 2) {
        assert.ok(salida.contenido.length < datos.length, 'el video de alta calidad debe ocupar menos después de la compresión');
        t.diagnostic('Muestra de 2 s: ' + datos.length + ' bytes → ' + salida.contenido.length + ' bytes');
      }
    });
  } finally { await rm(carpeta,{recursive:true,force:true}); }
});

test('rutas HTTP de adjuntos, permisos y ciclo de vida de los estados', async t => {
  process.env.AUTH_TOKEN_SECRET ||= randomUUID() + randomUUID();
  const cliente = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',{ serverSelectionTimeoutMS: 4000 });
  await cliente.connect();
  const db = cliente.db('poli_qa_medios_' + randomUUID().replaceAll('-',''));
  const carpeta = await mkdtemp(path.join(os.tmpdir(),'poli-qa-adjuntos-'));
  process.env.UPLOADS_DIR = carpeta;
  const servidor = crearAplicacion(db).listen(0,'127.0.0.1');
  await once(servidor,'listening');
  try {
    const direccion = servidor.address();
    assert.ok(direccion && typeof direccion !== 'string');
    const origen = 'http://127.0.0.1:' + direccion.port;
    const peticion = (ruta: string, sesion?: string, opts?: RequestInit) => fetch(origen + ruta,{...opts, headers: {
      ...(sesion ? { Authorization: 'Bearer ' + crearTokenLocal(sesion) } : {}), ...opts?.headers,
    }});
    const subir = (ruta:string, usuario:string|undefined, tipo:string, nombre:string, datos:Buffer) => peticion('/api/' + ruta,usuario,{
      method:'POST',headers:{'Content-Type':tipo,'X-Nombre-Archivo':encodeURIComponent(nombre)},body:new Uint8Array(datos),
    });
    await db.collection<{_id:string;role:string;status:string;displayName:string}>('users').insertMany(
      ['estudiante','docente','moderador','administrador'].map((id,i)=>({_id:id,displayName:id,status:'ACTIVE',role:['USER','USER','MODERATOR','ADMIN'][i]})));
    const png = await foto.clone().png().toBuffer();
    for (const [tipo, nombre, datos, resultado] of [
      ['image/png','foto.png',png,201], ['application/octet-stream','álbum.png',png,201],
      ['application/pdf','lectura.pdf',pdf,201], ['application/pdf','rota.pdf',Buffer.from('abc'),415],
      ['image/png','falsa.png',Buffer.from('PK'),415], ['application/octet-stream','aplicación.apk',Buffer.from('PK'),415],
      ['image/png','foto.exe.png',png,415], ['application/pdf','lector.exe',pdf,415], ['video/mp4','falso.mp4',png,415],
      ['image/png','vacio.png',Buffer.alloc(0),400],
    ] as const) await t.test(nombre, async () => {
      const r = await subir('archivos','estudiante',tipo,nombre,datos);
      assert.equal(r.status,resultado);
      if (r.status === 201) {
        const adjunto = await r.json();
        assert.equal(adjunto.nombreOriginal,nombre);
        const servido = await peticion(adjunto.url);
        assert.equal(servido.status,200); assert.equal(servido.headers.get('Content-Type'),adjunto.mime);
      }
    });
    await t.test('publicación de estados exige cuenta social activa',async () => {
      for (const rol of ['administrador','moderador',undefined]) assert.equal((await subir('estados',rol,'image/png','x.png',png)).status,rol ? 403 : 401);
      assert.equal((await subir('estados','estudiante','application/pdf','a.pdf',pdf)).status,415);
    });
    await t.test('foto dura 15 segundos y solo su propietario la retira',async () => {
      const r = await subir('estados','estudiante','image/png','a.png',png);
      assert.equal(r.status,201);
      const estado = await r.json(); assert.equal(estado.segundos,15); assert.equal(estado.propio,true);
      assert.ok(Math.abs(Date.parse(estado.vence) - Date.now() - 86400000) < 30000);
      assert.equal((await peticion('/api/estados/' + estado.id + '/archivo')).status,401);
      const listado = await (await peticion('/api/estados','docente')).json();
      assert.equal(listado[0].propio,false);
      const ruta = '/api/estados/' + estado.id;
      assert.equal((await peticion(ruta + '/archivo','docente')).status,200);
      assert.equal((await peticion(ruta + '/retirar','docente',{method:'PATCH'})).status,404);
      await db.collection('blocks').insertOne({blockerId:'estudiante',blockedId:'docente'});
      assert.equal((await peticion(ruta + '/archivo','docente')).status,404);
      assert.deepEqual(await (await peticion('/api/estados','docente')).json(),[]);
      assert.equal((await peticion(ruta + '/retirar','estudiante',{method:'PATCH'})).status,204);
      assert.equal((await peticion(ruta + '/archivo','estudiante')).status,404);
    });
    await t.test('estado vencido queda fuera de lista y no se puede descargar por URL',async () => {
      const estado = await (await subir('estados','estudiante','image/png','a.png',png)).json();
      await db.collection('estados.files').updateOne({_id:new ObjectId(estado.id)},{$set:{'metadata.vence':new Date(0)}});
      assert.deepEqual(await (await peticion('/api/estados','estudiante')).json(),[]);
      assert.equal((await peticion('/api/estados/' + estado.id + '/archivo','estudiante')).status,404);
    });
  } finally {
    await new Promise<void>(resolver=>servidor.close(()=>resolver()));
    await db.dropDatabase(); await cliente.close(); await rm(carpeta,{recursive:true,force:true});
  }
});
