'use client';
import { BuscadorDirectorio } from '@/componentes_compartidos/comunes/buscador-directorio';


import { useState } from 'react';
import { useAuth } from '@/modulos/autenticacion/controladores/contexto';
import type { PaginaSocial } from '@/servicios/api-cliente';

export function SelectorIdentidad({ paginas }: { paginas: PaginaSocial[] }) {
  const { usuario, alternarPagina } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  if (!usuario || usuario.role !== 'USER') return null;
  const propias = paginas.filter(p => p.propietarioId === usuario._id);
  if (!usuario.paginaDelegada && (usuario.accountType === 'PAGE' || !propias.length)) return null;

  async function alternar(id: string | null) {
    setOcupado(true);
    try { await alternarPagina(id); }
    catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar de perfil.');
      setOcupado(false);
    }
  }
  return <div className="selector-identidad">
    {usuario.paginaDelegada ?
      <button className="boton-secundario" disabled={ocupado} onClick={() => void alternar(null)}>Volver a mi perfil personal</button> :
      <details><summary>Usar Poli como</summary><BuscadorDirectorio etiqueta="Buscar mis páginas" mostrarTodos opciones={propias.map(p=>({id:p._id,avatarUrl:p.avatarUrl,nombre:p.nombre,detalle:p.categoria}))} elegir={id=>{if(!ocupado) void alternar(id);}} /></details>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
