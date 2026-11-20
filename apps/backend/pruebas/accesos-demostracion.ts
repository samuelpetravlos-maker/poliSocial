import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function comprobar() {
  const raiz = resolve(__dirname,'../../..');
  const origen = 'http://localhost:3001/api';
  let cuentas = 0;
  let publicaciones = 0;
  let comentarios = 0;
  const autores = new Set<string>();
  let muro: Array<{_id:string; authorId:string; pageId?:string}> = [];
  let autorizacion = '';
  for (const archivo of ['usuarios_prueba.txt','credenciales_admin_y_reporte.txt']) {
    const contenido = await readFile(resolve(raiz,archivo),'utf8');
    const lineas = contenido.split(/\r?\n/).filter(l=>l.includes(' | ')).slice(1);
    for (const linea of lineas) {
      const [,identificador,password] = linea.split(' | ');
      if (!identificador || !/^[a-z0-9_.]+$/.test(identificador)) continue;
      const r = await fetch(origen+'/autenticacion/sesion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identificador,password})});
      assert.equal(r.status,200,'Acceso de '+identificador);
      const sesion = await r.json();
      assert.equal(sesion.usuario.username,identificador);
      assert.equal(sesion.usuario.mustChangePassword,false);
      autores.add(sesion.usuario._id);
      cuentas++;
      if (identificador === 'bienestar') {
        autorizacion = 'Bearer '+sesion.token;
        const respuesta = await fetch(origen+'/publicaciones?limite=100',{headers:{Authorization:autorizacion}});
        assert.equal(respuesta.status,200);
        muro = (await respuesta.json()).publicaciones;
        assert.ok(muro.some(p=>p.authorId === sesion.usuario._id && p.pageId));
        const estados = await fetch(origen+'/estados',{headers:{Authorization:autorizacion}});
        assert.equal(estados.status,200,'La API en 3001 debe servir la versión actual con estados');
      }
    }
  }
  for (const p of muro) {
    if (!autores.has(p.authorId)) continue;
    publicaciones++;
    const r = await fetch(origen+'/publicaciones/'+p._id,{headers:{Authorization:autorizacion}});
    assert.equal(r.status,200);
    const d = await r.json();
    comentarios += d.comentarios?.length ?? 0;
  }
  assert.ok(cuentas >= 11 && publicaciones >= 8 && comentarios > 0);
  console.log(cuentas+' accesos reales, '+publicaciones+' publicaciones de sus autores y '+comentarios+' comentarios visibles.');
}
comprobar().catch(e => { console.error(e.message); process.exitCode=1; });
