'use client';

import { useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import type { PublicacionSocial } from '@/datos/modelos-sociales';
import type { Usuario, PaginaSocial } from '@/servicios/api-cliente';
import { listarPaginasApi } from '@/modulos/paginas/servicios/servicio-api';
import { listarPublicacionesApi } from '@/modulos/publicaciones/servicios/servicio-api';
import { DirectorioPaginas } from '@/modulos/paginas/vistas/directorio-paginas';
import { SeguridadCuenta } from '@/modulos/autenticacion/vistas/seguridad-cuenta';
import { adaptarPublicacionApi } from '@/modulos/inicio/servicios/adaptadores-api';
import { EncabezadoVista } from '@/modulos/inicio/vistas/encabezado-vista';
import { DatosPerfil } from './datos-perfil';

interface Propiedades {
  paginaElegida?:string; consulta?:string; cambiar?:(v:string)=>void;
  soloPaginas?: boolean;
  usuario: Usuario;
  token: string;
  publicaciones: PublicacionSocial[];
  guardadas: PublicacionSocial[];
  respondidasIds: string[];
  paginas: PaginaSocial[];
  setPaginas: Dispatch<SetStateAction<PaginaSocial[]>>;
  setPublicaciones: Dispatch<SetStateAction<PublicacionSocial[]>>;
  mostrarPublicacion: (publicacion: PublicacionSocial) => ReactNode;
}

const PESTANAS = ['Publicaciones', 'Respuestas', 'Guardados'] as const;
type Pestana = typeof PESTANAS[number];
const VACIO: Record<Pestana, string> = {
  Publicaciones: 'Aún no has publicado', Respuestas: 'Aún no has comentado publicaciones', Guardados: 'Aún no tienes publicaciones guardadas',
};
export function PerfilSocial({ paginaElegida, consulta, cambiar, soloPaginas, usuario, token, publicaciones, guardadas, respondidasIds, paginas, setPaginas, setPublicaciones, mostrarPublicacion }: Propiedades) {
  const [pestana, setPestana] = useState<Pestana>('Publicaciones');
  const propias = publicaciones.filter(p => p.autor.id === usuario._id);
  const contenido = { Publicaciones: propias, Respuestas: publicaciones.filter(p => respondidasIds.includes(p.id)), Guardados: guardadas };
  const paginaActiva = paginas.find(p => p._id === usuario.paginaId);
  if (soloPaginas) return <>
    <EncabezadoVista titulo="Páginas" />
    <DirectorioPaginas key={paginaElegida} paginaElegida={paginaElegida} consulta={consulta} cambiar={cambiar} token={token} usuario={usuario} paginas={paginas}
      alCambiar={pagina => setPaginas(actuales => [pagina, ...actuales.filter(p => p._id !== pagina._id)])}
      cargarPublicaciones={async id => {
        const r = await listarPublicacionesApi(token, 'global', undefined, id);
        const lista = r.publicaciones.map(adaptarPublicacionApi);
        setPublicaciones(actuales => [...actuales.filter(p => p.paginaId !== id), ...lista]);
      }}
      publicaciones={id => publicaciones.filter(p => p.paginaId === id).map(mostrarPublicacion)} />
  </>;
  return <>
    <EncabezadoVista titulo={usuario.accountType === 'PAGE' ? 'Perfil de página' : 'Mi perfil'} subtitulo={usuario.displayName} />
    <DatosPerfil usuario={usuario} token={token} cantidad={propias.length} portada={paginaActiva?.portadaUrl}
      seguidores={paginaActiva?.seguidores ?? usuario.followersCount}
      alActualizar={async () => setPaginas((await listarPaginasApi(token)).paginas)} />
    {!usuario.paginaDelegada && <SeguridadCuenta />}

    <div className="tabs-perfil" role="tablist">
      {PESTANAS.map(p => <button key={p} role="tab" aria-selected={pestana === p} className={`chip-filtro${p === pestana ? ' activo' : ''}`} onClick={() => setPestana(p)}>{p}</button>)}
    </div>
    <div role="tabpanel" className="lista-publicaciones">
      {contenido[pestana].length ? contenido[pestana].map(mostrarPublicacion) : <p className="tarjeta estado-vacio">{VACIO[pestana]}</p>}
    </div>
  </>;
}
