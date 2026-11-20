'use client';

import { useEffect, useRef, useState } from 'react';
import { cargarContenidoEstado, listarEstados, publicarEstado, retirarEstado, type EstadoUniversitario } from '../servicios/servicio-api';
import estilos from './estados.module.css';

const mensaje = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';

export function EstadosUniversitarios({ token, puedePublicar }: { token: string; puedePublicar: boolean }) {
  const [estados, setEstados] = useState<EstadoUniversitario[]>([]);
  const [seleccion, seleccionar] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [cargado, setCargado] = useState(false);
  const [reintento, recargar] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let activo = true;
    listarEstados(token).then(resultado => { if (activo) { setEstados(resultado); setCargado(true); } })
      .catch(e => { if (activo) setError(mensaje(e)); });
    const reloj = window.setInterval(() => setEstados(anterior => anterior.filter(e => Date.parse(e.vence) > Date.now())), 15000);
    return () => { activo = false; window.clearInterval(reloj); };
  }, [token, reintento]);

  async function subir(archivo?: File) {
    if (!archivo) return;
    setError(''); setSubiendo(true);
    try {
      const nuevo = await publicarEstado(archivo, token);
      setEstados(anteriores => [nuevo, ...anteriores.filter(e => e.id !== nuevo.id)]);
    } catch (e) { setError(mensaje(e)); } finally { setSubiendo(false); }
  }
  const posicion = estados.findIndex(e => e.id === seleccion);
  const estado = estados[posicion];
  return <section className={'tarjeta ' + estilos.seccion} aria-label="Estados universitarios">
    <header className={estilos.encabezado}><h2>Estados</h2>{puedePublicar && <>
      <button className="boton-secundario" disabled={subiendo} onClick={() => entrada.current?.click()}>{subiendo ? 'Procesando…' : 'Añadir estado'}</button>
      <input ref={entrada} hidden type="file" accept="image/*,video/*,.heic,.heif,.mkv,.avi,.mov" onChange={e => { void subir(e.target.files?.[0]); e.target.value = ''; }} />
    </>}</header>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(''); recargar(v => v + 1); }}>Actualizar</button></p>}
    {estados.length ? <div className={estilos.lista}>{estados.map(item => <button key={item.id} className={estilos.ficha} onClick={() => seleccionar(item.id)}>
      <span className={estilos.avatar}>{item.avatar ? <img src={item.avatar} alt="" /> : item.autor.trim().slice(0,1)}</span>
      <span>{item.propio ? 'Tu estado' : item.autor}</span>
    </button>)}</div> : <p>{cargado ? 'Sin estados en las últimas 24 horas.' : 'Cargando estados…'}</p>}
    {estado && <Visor key={estado.id} estado={estado} token={token} cerrar={() => seleccionar(null)}
      avanzar={() => seleccionar(estados[posicion + 1]?.id ?? null)} retirar={async () => {
        await retirarEstado(estado.id, token); seleccionar(null); setEstados(prev => prev.filter(e => e.id !== estado.id));
      }} />}
  </section>;
}

function Visor({ estado, token, cerrar, avanzar, retirar }: {
  estado: EstadoUniversitario; token: string; cerrar: () => void; avanzar: () => void; retirar: () => Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [reproduciendo, setReproduciendo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const proximo = useRef(avanzar);
  proximo.current = avanzar;
  const video = estado.mime.startsWith('video/');
  useEffect(() => {
    const dialog = dialogo.current;
    dialog?.showModal();
    const abortar = new AbortController();
    let recurso: string | undefined;
    cargarContenidoEstado(estado.id, token, abortar.signal).then(datos => {
      if (!abortar.signal.aborted) { recurso = URL.createObjectURL(datos); setUrl(recurso); }
    }).catch(e => { if (!abortar.signal.aborted) setError(mensaje(e)); });
    return () => { abortar.abort(); if (recurso) URL.revokeObjectURL(recurso); dialog?.close(); };
  }, [estado.id, token]);
  useEffect(() => {
    if (video || !reproduciendo || pausado) return;
    const reloj = window.setTimeout(() => proximo.current(), estado.segundos * 1000);
    return () => window.clearTimeout(reloj);
  }, [reproduciendo, pausado, video, estado.segundos]);
  useEffect(() => {
    const reloj = window.setTimeout(() => proximo.current(), Math.max(0, Date.parse(estado.vence) - Date.now()));
    return () => window.clearTimeout(reloj);
  }, [estado.vence]);
  return <dialog ref={dialogo} className={estilos.visor} aria-label={'Estado de ' + estado.autor} onCancel={cerrar}>
    <header className={estilos.encabezado}><strong>{estado.autor}</strong><button onClick={cerrar}>Cerrar</button></header>
    {error ? <p role="alert">{error}</p> : !url ? <p>Cargando…</p> : video
      ? <video key={url} src={url} autoPlay playsInline controls onEnded={avanzar} />
      : <img src={url} alt={'Estado de ' + estado.autor} onLoad={() => setReproduciendo(true)} />}
    <footer className={estilos.encabezado}>{estado.propio && <button onClick={() => retirar().catch(e => setError(mensaje(e)))}>Retirar estado</button>}
      {!video && <button aria-pressed={pausado} onClick={() => setPausado(v => !v)}>{pausado ? 'Continuar' : 'Pausar'}</button>}
      <button onClick={avanzar}>Siguiente</button></footer>
  </dialog>;
}
