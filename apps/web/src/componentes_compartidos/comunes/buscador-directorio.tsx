'use client';
import { Avatar } from '@/componentes_compartidos/comunes/avatar';
import { CampoBusqueda } from '@/componentes_compartidos/comunes/campo-busqueda';
import { useState } from 'react';
import { buscarCoincidencias } from '@/servicios/coincidencias';

interface Opcion { id:string; avatarUrl?:string | null; nombre:string; detalle:string; verificada?:boolean }
export function BuscadorDirectorio({ etiqueta, opciones, elegir, mostrarTodos=false, consulta, cambiar }: {
  etiqueta:string; opciones:Opcion[]; elegir:(id:string)=>void; mostrarTodos?:boolean; consulta?:string; cambiar?:(v:string)=>void;
}) {
  const [local, escribir] = useState('');
  const texto = consulta ?? local;
  const resultados = buscarCoincidencias(opciones,texto,o=>o.nombre,o=>o.detalle);
  return <div className="busqueda-directorio"><CampoBusqueda etiqueta={etiqueta} texto={texto} cambiar={cambiar ?? escribir} />
    {(mostrarTodos || texto.trim()) && <div className="resultados-directorio">{resultados.map(o=><button type="button" key={o.id} onClick={()=>{ elegir(o.id); if (!mostrarTodos) escribir(''); }}>
      <Avatar nombre={o.nombre} avatarUrl={o.avatarUrl} color="var(--verde)" tamano={40} />
      <span className="texto-resultado"><strong>{o.nombre}{o.verificada ? ' ✓' : ''}</strong><small>{o.detalle}</small></span></button>)}
      {!resultados.length && <p role="status">Sin coincidencias.</p>}</div>}
  </div>;
}
