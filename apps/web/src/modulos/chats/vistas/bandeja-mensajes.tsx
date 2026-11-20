'use client';
import { BuscadorDirectorio } from '@/componentes_compartidos/comunes/buscador-directorio';

import { useEffect, useState, type FormEvent } from 'react';
import { clienteHttp, obtenerApiUrl } from '@/servicios/api-cliente';
import { crearChatDirectoApi, enviarMensajeChatApi, listarMensajesChatApi, marcarChatLeidoApi, type ChatApi } from '../servicios/servicio-api';
import type { Usuario } from '@/modulos/usuarios/servicios/servicio-api';
import type { ConversacionSocial } from '@/datos/modelos-sociales';

import { usarChatEnVivo } from '../controladores/usar-chat-en-vivo';

interface Propiedades {
  token: string;
  usuarioId: string;
  contactos: Usuario[];
  chats: ConversacionSocial[];
  activo: string;
  seleccionar: (id: string) => void;
  alCrear: (chat: ChatApi) => void;
  crearGrupo: () => void;
}
function ArchivoChat({ruta,token}: {ruta: string; token: string}) {
  const [error, setError] = useState('');
  async function descargar() {
    try {
      const api = obtenerApiUrl();
      const respuesta = await fetch(api + ruta, {headers:{Authorization:'Bearer '+token}});
      if (!respuesta.ok) throw new Error('El adjunto ya no está disponible.');
      const contenido = await respuesta.blob();
      const url = URL.createObjectURL(contenido);
      const enlace = document.createElement('a');
      enlace.href = url;
      const nombre = respuesta.headers.get('content-disposition')?.split("filename*=UTF-8''")[1];
      enlace.download = nombre ? decodeURIComponent(nombre) : 'adjunto.' + (contenido.type.split('/')[1] || 'bin');
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo descargar.'); }
  }
  if (/^\/archivos\/[\w.-]+$/.test(ruta)) return <a href={obtenerApiUrl().replace(/\/api\/?$/,'')+ruta} target="_blank" rel="noreferrer">Abrir adjunto</a>;
  if (!/^\/chats\/[a-f0-9]{24}\/adjuntos\/[a-f0-9]{24}$/.test(ruta)) return null;
  return <><button onClick={descargar}>Descargar adjunto</button>{error && <small role="alert">{error}</small>}</>;
}
export function BandejaMensajes({token, usuarioId, contactos, chats, activo, seleccionar, alCrear, crearGrupo}: Propiedades) {
  const [texto, setTexto] = useState('');
  const [adjunto, setAdjunto] = useState<File>();
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [version, actualizar] = useState(0);
  const [mensajes, setMensajes] = useState<Array<Record<string, unknown>>>([]);
  const chat = chats.find((item) => item.id === activo) ?? chats[0];
  const id = chat?.id;
  const { escribiendo, indicarEscritura } = usarChatEnVivo(token, id, () => actualizar(v => v + 1));
  useEffect(() => { setTexto(''); setAdjunto(undefined); setMensajes([]); setError(''); }, [id, token]);
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    let temporizador: ReturnType<typeof setTimeout>;
    async function cargar() {
      try {
        const datos = await listarMensajesChatApi(id!, token);
        if (!vigente) return;
        setMensajes(datos.mensajes.slice().reverse());
        await marcarChatLeidoApi(id!, token);
      } catch (e) { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo actualizar el chat.'); }
      if (vigente) temporizador = setTimeout(cargar, 4000);
    }
    void cargar();
    return () => { vigente = false; clearTimeout(temporizador); };
  }, [id, token, version]);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id || enviando || (!texto.trim() && !adjunto)) return;
    setEnviando(true); setError('');
    try {
      const archivo = adjunto ? await clienteHttp<{url:string}>('/chats/'+id+'/adjuntos', {
        method:'POST', headers:{'Content-Type': adjunto.type || 'application/octet-stream', 'X-Nombre-Archivo':encodeURIComponent(adjunto.name)}, body:adjunto
      },token) : undefined;
      await enviarMensajeChatApi(id, texto.trim(), token, archivo?.url);
      indicarEscritura(false); setTexto(''); setAdjunto(undefined); actualizar(valor => valor + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.'); }
    finally { setEnviando(false); }
  }
  return <section>
    <header className="encabezado-vista"><h1>Mensajes</h1><button className="boton-primario" onClick={crearGrupo}>Nuevo grupo</button></header>
    {error && <p role="alert">{error}</p>}
    <div className="mensajeria tarjeta"><aside className="lista-chats">
      <BuscadorDirectorio etiqueta="Iniciar conversación" opciones={contactos.filter(c=>c._id!==usuarioId).map(c=>({id:c._id,avatarUrl:c.avatarUrl,nombre:c.displayName,detalle:'@'+c.username}))}
        elegir={async id=>{try {alCrear(await crearChatDirectoApi(id,token));} catch(e){setError(e instanceof Error ? e.message : 'No se pudo iniciar el chat.');}}} />
      {chats.map(c => <button key={c.id} onClick={() => seleccionar(c.id)} className={'fila-chat' + (id === c.id ? ' activo' : '')}>
        <span className="fila-chat-texto"><strong>{c.nombre}</strong><small>{c.ultimo}</small></span>{c.noLeidos > 0 && <span>{c.noLeidos}</span>}
      </button>)}
    </aside><section className="conversacion">{chat ? <>
      <header className="conversacion-cabecera"><div><strong>{chat.nombre}</strong><span>{chat.descripcion}</span></div></header>
      <div className="hilo-mensajes" aria-live="polite">{mensajes.map(m => {
        const propio = m.senderId === usuarioId;
        return <article className={'burbuja-fila' + (propio ? ' propia' : '')} key={String(m._id)}>
          <div className={'burbuja' + (propio ? ' burbuja-propia' : '')}><small>{propio ? 'Tú' : String(m.senderName ?? chat.nombre)}</small>
          {m.text ? <p>{String(m.text)}</p> : null}{typeof m.mediaUrl === 'string' && <ArchivoChat ruta={m.mediaUrl} token={token} />}
          {propio && Array.isArray(m.readBy) && m.readBy.some(id => id !== usuarioId) && <small>Leído</small>}<time>{new Date(String(m.createdAt)).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}</time></div></article>;
      })}</div>
      {escribiendo && <small role="status">Escribiendo…</small>}
      <form className="entrada-mensaje" onSubmit={enviar}>
        <label className="boton-secundario">Adjuntar<input type="file" hidden accept="image/*,video/*,application/pdf" onChange={e => {setAdjunto(e.target.files?.[0]); e.target.value='';}} /></label>
        <input aria-label="Escribe un mensaje" placeholder="Escribe un mensaje" value={texto} onChange={e=>{setTexto(e.target.value); indicarEscritura(!!e.target.value.trim());}} maxLength={5000}/>
        <button className="boton-primario" disabled={enviando || (!texto.trim() && !adjunto)}>Enviar</button>
      </form>{adjunto && <button onClick={()=>setAdjunto(undefined)}>Quitar {adjunto.name}</button>}
    </> : <p className="estado-vacio">Elige un contacto o crea un grupo para empezar.</p>}</section></div>
  </section>;
}
