import { chromium } from 'playwright-core';
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';

const servidor = process.env.POLI_QA_WEB || 'http://localhost:3000';
const api = process.env.POLI_QA_API;
const rutaChrome = process.env.CHROME_PATH;
const clave = process.env.POLI_QA_CLAVE || '12345678';
const capturas = process.env.POLI_QA_CAPTURAS || await mkdtemp(join(tmpdir(),'poli-interfaz-'));
let navegador;
before(async () => {
  await mkdir(capturas,{recursive:true});
  navegador = await chromium.launch(rutaChrome ? { executablePath:rutaChrome } : { channel:'chrome' });
});
after(async () => { await navegador?.close(); });

async function visible(pagina,rol,nombre) {
  const elementos = pagina.getByRole(rol,{name:nombre,exact:true});
  for (const e of await elementos.all()) if (await e.isVisible()) return e;
  throw new Error('No hay un control visible «' + nombre + '».');
}

async function iniciarSesion(pagina, id) {
  if (api) await pagina.addInitScript(valor => { window.__POLIHUB_API__ = valor; },api);
  await pagina.addInitScript(() => {
    const observado = new MutationObserver(() => {
      if (!document.querySelector('.barra-sesion-banner .acciones-sesion') || sessionStorage.getItem('poli_qa_primera_ruta')) return;
      sessionStorage.setItem('poli_qa_primera_ruta',location.pathname);
      observado.disconnect();
    });
    observado.observe(document,{childList:true,subtree:true});
  });
  pagina.setDefaultTimeout(10000);
  await pagina.goto(servidor,{waitUntil:'domcontentloaded'});
  await pagina.getByLabel('Correo institucional o nombre de usuario').fill(id);
  await pagina.getByLabel('Contraseña',{exact:true}).fill(clave);
  await pagina.getByRole('button',{name:'Entrar a Poli Social Network'}).click();
  await pagina.waitForURL(url => url.pathname === (id === 'admin' ? '/admin' : '/inicio'));
  await pagina.locator('.barra-sesion-banner').waitFor({timeout:25000});
  assert.equal(await pagina.evaluate(() => sessionStorage.getItem('poli_qa_primera_ruta')), id === 'admin' ? '/admin' : '/inicio');
}

async function comprobarConversacion(pagina) {
  const otro = await navegador.newContext({viewport:{width:1280,height:860}});
  try {
    const receptor = await otro.newPage();
    await iniciarSesion(receptor,'bienestar');
    const conectado = receptor.waitForResponse(r => r.url().includes('/socket.io/?EIO=4') && r.ok());
    await (await visible(receptor,'button','Mensajes')).click();
    await receptor.getByRole('textbox',{name:'Escribe un mensaje'}).waitFor();
    await conectado;
    const entrada = pagina.getByRole('textbox',{name:'Escribe un mensaje'});
    await entrada.pressSequentially('Consulta sobre la biblioteca',{delay:75});
    await receptor.getByText('Escribiendo…',{exact:true}).waitFor();
    await entrada.press('Enter');
    await receptor.locator('.burbuja').getByText('Consulta sobre la biblioteca',{exact:true}).waitFor();
  } finally { await otro.close(); }
}

for (const id of ['admin','moderador','estudiante','bienestar']) test('Interfaz de ' + id, async t => {
  const contexto = await navegador.newContext({ viewport:{width:1440,height:950}, locale:'es-CO' });
  const errores = [];
  const pagina = await contexto.newPage();
  try {
    pagina.on('pageerror', e => errores.push(e.message));
    pagina.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errores.push(m.text().slice(0,350)); });
    await iniciarSesion(pagina,id);
    const campana = pagina.getByRole('button',{name:'Notificaciones',exact:true});
    await campana.click();
    await pagina.getByRole('heading',{name:'Notificaciones',exact:true}).waitFor();
    await campana.click();
    const personal = id === 'admin' || id === 'moderador';
    const comprobarAncho = async (tamano,area) => {
      const medidas = await pagina.evaluate(() => ({ contenido:document.documentElement.scrollWidth, visible:window.innerWidth }));
      await pagina.screenshot({ path:join(capturas,id + '-' + area + '-' + tamano + '.png') });
      if (medidas.contenido > medidas.visible + 1) {
        const excedentes = await pagina.locator('main *').evaluateAll(elementos => elementos.filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => [e.tagName,e.className,Math.round(e.getBoundingClientRect().right)]).slice(0,18));
        assert.fail(JSON.stringify({ ...medidas, excedentes }));
      }
    };
    if (id === 'admin') {
      const menu = await visible(pagina,'button','Carreras y listas'); await menu.click();
      await pagina.getByText(/Catálogos institucionales|Carreras y listas/i).first().waitFor({state:'attached'});
      await comprobarAncho(1440,'catalogos');
      await (await visible(pagina,'button','Inicio')).click();
    }
    await pagina.getByRole('heading',{name:'Estados',exact:true}).waitFor();
    if (personal) {
      assert.equal(await pagina.getByRole('button',{name:'Añadir estado'}).count(),0);
      assert.equal(await pagina.getByRole('textbox',{name:'Contenido de la publicación'}).count(),0);
      assert.equal(await pagina.getByRole('button',{name:'Mi Perfil',exact:true}).count(),0);
    } else {
      await pagina.getByRole('button',{name:'Añadir estado'}).waitFor();
      await pagina.getByRole('textbox',{name:'Contenido de la publicación'}).waitFor();
    }
    if (id === 'estudiante' && process.env.POLI_QA_PAGINA) {
      await pagina.getByRole('button',{name:'Buscar en Poli Social Network',exact:true}).click();
      const dialogo = pagina.getByRole('dialog',{name:'Buscar en Poli Social Network'});
      await dialogo.getByRole('searchbox').fill('bienstar');
      const resultadoBienestar = dialogo.getByRole('button',{name:/Bienestar QA/});
      await resultadoBienestar.locator('.avatar img').evaluate(img => img.decode());
      await resultadoBienestar.click();
      await pagina.getByRole('heading',{name:'Bienestar QA'}).waitFor();
      await pagina.getByRole('button',{name:/Limpiar: Buscar páginas/}).click();
      await (await visible(pagina,'button','Comunidades')).click();
      const filtros = pagina.locator('.explorar-comunidades');
      for (const ancho of [1440,390]) {
        await pagina.setViewportSize({width:ancho,height:900});
        await filtros.getByRole('button',{name:'Mi sede'}).click();
        await filtros.getByRole('searchbox').fill('robotica');
        await filtros.getByRole('button',{name:/Limpiar/}).click();
        assert.ok(await filtros.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
        await comprobarAncho(ancho,'comunidades');
      }
      await pagina.setViewportSize({width:1440,height:900});
      await (await visible(pagina,'button','Inicio')).click();
    }
    if (id === 'bienestar' && process.env.POLI_QA_FOTO) {
      await (await visible(pagina,'button','Mi Perfil')).click();
      await pagina.getByLabel('Cambiar foto').setInputFiles(process.env.POLI_QA_FOTO);
      await pagina.getByRole('button',{name:'Quitar foto'}).click();
      await pagina.getByRole('button',{name:'Quitar foto'}).waitFor({state:'hidden'});
      await (await visible(pagina,'button','Inicio')).click();
    }
    if (id === 'estudiante' && process.env.POLI_QA_PAGINA) {
      await (await visible(pagina,'button','Mi Perfil')).click();
      if (process.env.POLI_QA_FOTO) {
        await pagina.getByLabel('Cambiar foto').setInputFiles(process.env.POLI_QA_FOTO);
        await pagina.getByRole('button',{name:'Quitar foto'}).click();
        await pagina.getByRole('button',{name:'Quitar foto'}).waitFor({state:'hidden'});
      }
      await (await visible(pagina,'button','Páginas')).click();
      await pagina.getByText('Crear una página',{exact:true}).click();
      await pagina.getByLabel('Nombre de la página').fill(process.env.POLI_QA_PAGINA);
      await pagina.getByRole('button',{name:'Crear página',exact:true}).click();
      const selector = pagina.locator('.selector-identidad summary').first();
      await pagina.getByRole('button',{name:'Solicitar verificación'}).click();
      await pagina.getByRole('button',{name:'Verificación solicitada'}).waitFor();
      await selector.click();
      await selector.locator('..').getByRole('button').filter({hasText:process.env.POLI_QA_PAGINA}).click();
      await pagina.getByRole('button',{name:'Volver a mi perfil personal'}).first().waitFor();
      await pagina.reload();
      await pagina.getByRole('button',{name:'Volver a mi perfil personal'}).first().click();
      await selector.waitFor();
      await (await visible(pagina,'button','Inicio')).click();
    }
    if (id === 'estudiante' && process.env.POLI_QA_FOTO) {
      const estados = pagina.getByRole('region',{name:'Estados universitarios'});
      await estados.locator('input[type=file]').setInputFiles(process.env.POLI_QA_FOTO);
      await estados.getByRole('button',{name:/Tu estado/}).click();
      const visor = pagina.getByRole('dialog',{name:/Estado de/});
      await visor.locator('img').waitFor();
      assert.ok(await visor.locator('img').evaluate(img => img.complete && img.naturalWidth > 0));
      await visor.getByRole('button',{name:'Retirar estado'}).click();
      await visor.waitFor({state:'hidden'});
      const compositor = pagina.getByRole('group',{name:'Crear una publicación'});
      await compositor.locator('input[type=file]').setInputFiles(process.env.POLI_QA_FOTO);
      await compositor.getByRole('textbox',{name:'Contenido de la publicación'}).fill('Foto de la biblioteca');
      await compositor.getByRole('button',{name:'Publicar',exact:true}).click();
      const adjunto = pagina.locator('.publicacion-adjunto img').first();
      await adjunto.waitFor();
      await pagina.reload();
      await adjunto.waitFor();
      const tarjeta = adjunto.locator('xpath=ancestor::article[1]');
      const texto = tarjeta.getByText('Foto de la biblioteca',{exact:true});
      await texto.waitFor();
      assert.ok(await texto.evaluate(el => el.getBoundingClientRect().bottom <= el.closest('article').querySelector('.publicacion-adjunto').getBoundingClientRect().top));
    }
    await comprobarAncho(1440,'inicio');
    await pagina.setViewportSize({width:390,height:844});
    await comprobarAncho(390,'inicio');
    if (id === 'admin') {
      await (await visible(pagina,'button','Carreras y listas')).click();
      await comprobarAncho(390,'catalogos');
    }
    if (id === 'estudiante') {
      await (await visible(pagina,'button','Mensajes')).click();
      await pagina.getByRole('heading',{name:'Mensajes',exact:true}).waitFor();
      await pagina.getByLabel('Iniciar conversación').waitFor();
      if (process.env.POLI_QA_CONTACTO) {
        const biblioteca = pagina.waitForResponse(r => r.url().endsWith('/socket.io/socket.io.esm.min.js') && r.ok());
        await pagina.getByLabel('Iniciar conversación').fill(process.env.POLI_QA_CONTACTO);
        await pagina.locator('.lista-chats .resultados-directorio button').first().click();
        await pagina.getByRole('textbox',{name:'Escribe un mensaje'}).waitFor();
        await biblioteca;
        await comprobarConversacion(pagina);
      }
      await comprobarAncho(390,'mensajes');
    }
    assert.deepEqual(errores,[]);
    t.diagnostic('Evidencia: ' + capturas);
  } catch (error) {
    t.diagnostic('Pantalla durante el fallo: ' + (await pagina.locator('h1,h2,h3,summary,[role=alert]').allTextContents()).slice(0,24).join(' | '));
    await pagina.screenshot({path:join(capturas,id + '-fallo.png')});
    throw error;
  } finally { await contexto.close(); }
});

