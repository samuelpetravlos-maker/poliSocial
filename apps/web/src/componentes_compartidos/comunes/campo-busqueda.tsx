'use client';

import { useRef } from 'react';
import { Icono } from './iconos';

export function CampoBusqueda({ etiqueta, texto, cambiar, placeholder = etiqueta }: {
  etiqueta: string; texto: string; cambiar: (texto: string) => void; placeholder?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  return <div className="campo-busqueda">
    <Icono nombre="buscar" tamano={19} />
    <input ref={entrada} type="search" placeholder={placeholder} aria-label={etiqueta}
      value={texto} onChange={e => cambiar(e.target.value)} onKeyDown={e => {
        if (e.key === 'Escape' && texto) { e.preventDefault(); cambiar(''); }
      }} />
    {texto && <button type="button" aria-label={'Limpiar: ' + etiqueta} onClick={() => { cambiar(''); entrada.current?.focus(); }}>
      <Icono nombre="cerrar" tamano={16} /></button>}
  </div>;
}
