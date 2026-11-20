'use client';
import { Avatar } from '@/componentes_compartidos/comunes/avatar';

import { useEffect, useRef, useState } from 'react';
import { CampoBusqueda } from '@/componentes_compartidos/comunes/campo-busqueda';
import { buscarCoincidencias } from '@/servicios/coincidencias';
import { listarComunidadesApi } from '@/modulos/comunidades/servicios/comunidades-api';
import { NOMBRES_CATEGORIAS, type CategoriaComunidad } from '@/modulos/comunidades/servicios/datos-comunidades';

export type DestinoBusqueda = 'inicio' | 'paginas' | 'comunidades';
export interface ResultadoBusqueda { id:string; avatarUrl?:string | null; nombre:string; detalle:string; destino:DestinoBusqueda }
export function BusquedaGlobal({ opciones, tokenSocial, elegir, cerrar }: {
  opciones:ResultadoBusqueda[]; tokenSocial?:string; elegir:(r:ResultadoBusqueda)=>void; cerrar:()=>void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [texto, escribir] = useState('');
  const [comunidades, guardar] = useState<ResultadoBusqueda[]>([]);
  const [error, avisar] = useState('');
  useEffect(()=>{
    const nodo = dialogo.current;
    nodo?.showModal();
    nodo?.querySelector('input')?.focus();
    return ()=>nodo?.close();
  },[]);
  useEffect(()=>{
    let vigente=true;
    if(tokenSocial) listarComunidadesApi(tokenSocial).then(r=>{
      if(vigente) guardar(r.comunidades.map(c=>({id:String(c._id), nombre:String(c.nombre), detalle:NOMBRES_CATEGORIAS[c.categoria as CategoriaComunidad], destino:'comunidades'})));
    }).catch(()=>{if(vigente) avisar('No se pudieron cargar las comunidades.');});
    return ()=>{vigente=false;};
  },[tokenSocial]);
  const resultados = buscarCoincidencias([...opciones,...comunidades],texto,r=>r.nombre,r=>r.detalle).slice(0,20);
  return <dialog ref={dialogo} className="dialogo-busqueda" aria-label="Buscar en Poli Social Network" onCancel={cerrar}>
    <header><h2>Buscar en Poli Social Network</h2><button className="boton-secundario" onClick={cerrar}>Cerrar</button></header>
    <CampoBusqueda etiqueta="Buscar en la comunidad" placeholder="Buscar publicaciones, páginas o comunidades" texto={texto} cambiar={escribir}/>
    {error && <p role="status">{error}</p>}
    <div className="resultados-directorio">{resultados.map(r=><button key={r.destino+r.id} onClick={()=>elegir(r)}>
      <Avatar nombre={r.destino === 'inicio' ? r.detalle : r.nombre} avatarUrl={r.avatarUrl} color="var(--verde)" tamano={40} />
      <span className="texto-resultado"><strong>{r.nombre}</strong><small>{{inicio:'Publicación',paginas:'Página',comunidades:'Comunidad'}[r.destino]} · {r.detalle}</small></span></button>)}
      {!resultados.length && <p role="status">Sin coincidencias.</p>}</div>
  </dialog>;
}
