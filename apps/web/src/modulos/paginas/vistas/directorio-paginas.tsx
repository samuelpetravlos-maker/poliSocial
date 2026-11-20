'use client';

import { BuscadorDirectorio } from '@/componentes_compartidos/comunes/buscador-directorio';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Avatar, InsigniaVerificado } from '@/componentes_compartidos/comunes/avatar';
import { useAuth } from '@/modulos/autenticacion/controladores/contexto';
import {
  solicitarVerificacionApi, actualizarPaginaApi, crearPaginaApi, listarCatalogosPublicosApi, obtenerApiUrl, seguirPaginaApi,
  subirArchivoApi, type PaginaSocial, type Usuario,
} from '@/servicios/api-cliente';
import { SelectorIdentidad } from './selector-identidad';

interface Propiedades {
  paginaElegida?:string; consulta?: string; cambiar?: (v:string)=>void;
  token: string;
  usuario: Usuario;
  paginas: PaginaSocial[];
  alCambiar: (pagina: PaginaSocial) => void;
  cargarPublicaciones: (id: string) => Promise<void>;
  publicaciones: (id: string) => ReactNode;
}

export function DirectorioPaginas({ paginaElegida, consulta, cambiar, usuario, token, paginas, alCambiar, publicaciones, cargarPublicaciones }: Propiedades) {
  const { recargarPerfil } = useAuth();
  const [seleccion, setSeleccion] = useState(paginaElegida || usuario.paginaId || '');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const activa = paginas.find(p => p._id === seleccion);
  const gestiona = activa && (activa.propietarioId === usuario._id || usuario.paginaId === activa._id);
  useEffect(() => {
    listarCatalogosPublicosApi().then(r => setCategorias(r.catalogos.filter(c => c.tipo === 'categoria_pagina' && c.activo && !c.soloPersonal).map(c => c.nombre)))
      .catch(() => setMensaje('No se pudieron cargar las categorías de página.'));
  }, []);
  async function ejecutar(accion: () => Promise<void>) {
    setMensaje(''); setOcupado(true);
    try { await accion(); }
    catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
    finally { setOcupado(false); }
  }
  async function guardar(evento: FormEvent<HTMLFormElement>, pagina?: PaginaSocial) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const campos = new FormData(formulario);
    const datos = {
      nombre: String(campos.get('nombre')).trim(),
      descripcion: String(campos.get('descripcion')).trim(),
      categoria: String(campos.get('categoria')),
    };
    await ejecutar(async () => {
      const resultado = pagina ? await actualizarPaginaApi(pagina._id, datos, token) : await crearPaginaApi(datos, token);
      alCambiar({ ...pagina, ...resultado.pagina });
      setSeleccion(resultado.pagina._id);
      if (usuario.paginaId === resultado.pagina._id) await recargarPerfil();
      if (!pagina) formulario.reset();
      setMensaje(pagina ? 'Datos de página actualizados.' : 'Página creada. Ya puedes seleccionarla en «Usar Poli como».');
    });
  }
  function campos(pagina?: PaginaSocial) {
    const opciones = Array.from(new Set([...(pagina ? [pagina.categoria] : []), ...categorias]));
    return <>
      <label>Nombre de la página<input name="nombre" required minLength={3} maxLength={80} defaultValue={pagina?.nombre} /></label>
      <label>Descripción<textarea name="descripcion" maxLength={500} defaultValue={pagina?.descripcion} /></label>
      <label>Categoría<select name="categoria" required defaultValue={pagina?.categoria || opciones[0]}>
        {opciones.map(c => <option key={c}>{c}</option>)}
      </select></label>
    </>;
  }
  async function cambiarFoto(pagina: PaginaSocial, campo: 'avatarUrl' | 'portadaUrl', archivo?: File) {
    if (!archivo) return;
    await ejecutar(async () => {
      const subida = await subirArchivoApi(archivo, token);
      if (!subida.mime.startsWith('image/')) throw new Error('Elige una imagen para el perfil.');
      const url = new URL(subida.url, obtenerApiUrl()).href;
      const r = await actualizarPaginaApi(pagina._id, { [campo]: url }, token);
      alCambiar({ ...pagina, ...r.pagina });
      if (usuario.paginaId === pagina._id) await recargarPerfil();
      setMensaje('Imagen actualizada.');
    });
  }
  return <section className="tarjeta tarjeta-seguridad">
    <h3>{usuario.accountType === 'PAGE' ? 'Herramientas de página' : 'Páginas de la comunidad'}</h3>
    <SelectorIdentidad paginas={paginas} />
    {usuario.accountType !== 'PAGE' && <details><summary>Crear una página</summary>
      <form className="perfil-formulario" onSubmit={e => void guardar(e)}>
        {campos()}<button className="boton-primario" disabled={ocupado || !categorias.length}>Crear página</button>
      </form>
    </details>}
    <BuscadorDirectorio etiqueta="Buscar páginas por nombre o categoría" consulta={consulta} cambiar={cambiar} mostrarTodos opciones={paginas.map(p=>({id:p._id,avatarUrl:p.avatarUrl,nombre:p.nombre,detalle:p.categoria,verificada:p.isVerified}))}
      elegir={id=>{setSeleccion(id); void ejecutar(()=>cargarPublicaciones(id));}} />
    {activa && <article className="perfil-pagina-detalle" key={activa._id}>
      <div className="portada-pagina" style={{ backgroundImage: activa.portadaUrl ? `url(${activa.portadaUrl})` : undefined }} />
      <Avatar nombre={activa.nombre} color="#1b5e20" tamano={65} avatarUrl={activa.avatarUrl} />
      <h3>{activa.nombre} {activa.isVerified && <InsigniaVerificado />}</h3>
      <p>{activa.descripcion}</p><p>{activa.categoria} · {activa.seguidores} seguidores</p>
      {gestiona && !activa.isVerified && <button type="button" className="boton-secundario" disabled={ocupado || !!activa.solicitudVerificacion}
        onClick={() => void ejecutar(async () => {
          const resultado = await solicitarVerificacionApi(activa._id, token);
          alCambiar({ ...activa, ...resultado.pagina }); setMensaje('Solicitud enviada a administración.');
        })}>{activa.solicitudVerificacion ? 'Verificación solicitada' : 'Solicitar verificación'}</button>}
      {gestiona ? <details><summary>Actualizar página</summary>
        <form className="perfil-formulario" onSubmit={e => void guardar(e, activa)}>
          {campos(activa)}<button className="boton-primario" disabled={ocupado}>Guardar cambios</button>
        </form>
        {(['avatarUrl', 'portadaUrl'] as const).map(c => <label className="boton-secundario" key={c}>
          {c === 'avatarUrl' ? 'Cambiar foto' : 'Cambiar portada'}
          <input type="file" accept="image/*" hidden disabled={ocupado} onChange={e => void cambiarFoto(activa, c, e.target.files?.[0])} />
        </label>)}
        {(['avatarUrl', 'portadaUrl'] as const).map(c => activa[c] && <button key={c} type="button" className="boton-secundario" disabled={ocupado} onClick={() => void ejecutar(async () => {
          const resultado = await actualizarPaginaApi(activa._id, { [c]: null }, token);
          alCambiar({ ...activa, ...resultado.pagina });
          if (usuario.paginaId === activa._id) await recargarPerfil();
        })}>{c === 'avatarUrl' ? 'Quitar foto' : 'Quitar portada'}</button>)}
      </details> : <button className="boton-secundario" disabled={ocupado} onClick={() => void ejecutar(async () => {
        const r = await seguirPaginaApi(activa._id, !activa.siguiendo, token);
        alCambiar({ ...activa, ...r });
      })}>{activa.siguiendo ? 'Dejar de seguir' : 'Seguir página'}</button>}
      {publicaciones(activa._id)}
    </article>}
    {mensaje && <p role="status">{mensaje}</p>}
  </section>;
}
