'use client';
import { useState, useEffect } from 'react';
import { listarNotificacionesApi, marcarNotificacionLeidaApi, type NotificacionApi } from '@/servicios/api-cliente';
import { Icono } from '@/componentes_compartidos/comunes/iconos';

const nombres: Record<string, string> = {
  NEW_FOLLOWER: 'empezó a seguirte', LIKE: 'reaccionó a tu publicación', COMMENT: 'comentó tu publicación',
  MENTION: 'te mencionó', ANSWER_ACCEPTED: 'aceptó tu respuesta',
};
export function BandejaNotificaciones({token, alAbrir}: {token:string; alAbrir:(aviso:NotificacionApi)=>void}) {
  const [abierta, abrir] = useState(false);
  const [avisos, guardar] = useState<NotificacionApi[]>([]);
  const [pendientes, contar] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      try {
        const datos = await listarNotificacionesApi(token);
        if (vigente) { guardar(datos.notificaciones); contar(datos.noLeidas); setError(''); }
      } catch (e) { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar los avisos.'); }
    };
    void cargar();
    const intervalo = window.setInterval(cargar, 15000);
    return () => { vigente = false; window.clearInterval(intervalo); };
  }, [token, abierta]);

  return <div className="bandeja-moderacion-contenedor"><button className="boton-icono-con-badge" aria-label="Notificaciones" aria-expanded={abierta} onClick={()=>abrir(!abierta)}>
    <Icono nombre="campana" tamano={21}/>{pendientes > 0 && <span className="badge">{pendientes}</span>}</button>
    {abierta && <section className="tarjeta bandeja-moderacion"><h2>Notificaciones</h2>{error && <p role="alert">{error}</p>}
      {!error && !avisos.length && <p>Todavía no tienes notificaciones.</p>}
      {avisos.map(n => <button key={n._id} className="aviso-moderacion" onClick={async () => {
        try { if (!n.isRead) { await marcarNotificacionLeidaApi(n._id, token); guardar(lista => lista.map(item => item._id === n._id ? {...item, isRead:true} : item)); contar(total => Math.max(0,total-1)); } abrir(false); alAbrir(n); }
        catch(e) { setError(e instanceof Error ? e.message : 'No se pudo marcar como leída.'); }
      }}><span>{n.actorSnapshot.displayName} {n.summary ?? nombres[n.type] ?? 'envió un aviso'}</span><small>{n.isRead ? 'Leída' : 'Marcar como leída'}</small></button>)}
    </section>}
  </div>;
}
