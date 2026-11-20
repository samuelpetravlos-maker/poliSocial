'use client';

import { useEffect, useState } from 'react';
import { NOMBRE_CANAL, NOMBRES_FORMATO, type FormatoPublicacion, nombreDeSede, type AutorSocial, type Canal } from '@/datos/modelos-sociales';
import { Avatar } from '@/componentes_compartidos/comunes/avatar';
import { Icono } from '@/componentes_compartidos/comunes/iconos';
import type { PaginaSocial } from '@/modulos/paginas/servicios/servicio-api';

const CANALES_DISPONIBLES: Canal[] = ['GENERAL', 'ACADEMICO', 'PROYECTOS', 'MERCADO'];

export interface DatosNuevaPublicacion {
  texto: string;
  canal: Canal;
  titulo: string;
  precio: string;
  archivos: File[];
  formato: FormatoPublicacion;
  opcionesEncuesta?: string[];
  ubicacion?: string;
  fechaEvento?: string;
}

function VistaPreviaAdjunto({ archivo }: { archivo: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const origen = URL.createObjectURL(archivo);
    setUrl(origen);
    return () => URL.revokeObjectURL(origen);
  }, [archivo]);
  if (!url) return null;
  if (archivo.type.startsWith('image/')) return <img src={url} alt={archivo.name} style={{ maxWidth: '100%', maxHeight: 240 }} />;
  if (archivo.type.startsWith('video/')) return <video src={url} controls preload="metadata" style={{ maxWidth: '100%', maxHeight: 240 }} />;
  return null;
}

export function CompositorPublicacion({
  autor,
  canalInicial = 'GENERAL',
  onPublicar,
}: {
  autor: AutorSocial;
  canalInicial?: Canal;
  paginas?: PaginaSocial[];
  onPublicar: (datos: DatosNuevaPublicacion) => Promise<boolean>;
}) {
  const [texto, setTexto] = useState('');
  const [canal, setCanal] = useState<Canal>(canalInicial);
  const [titulo, setTitulo] = useState('');
  const [precio, setPrecio] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [errorArchivos, setErrorArchivos] = useState('');
  const [formato, setFormato] = useState<FormatoPublicacion>('NOTICIA');
  const [opciones, setOpciones] = useState(['', '']);
  const [ubicacion, setUbicacion] = useState('');
  const [fecha, setFecha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [versionArchivo, setVersionArchivo] = useState(0);
  const canales = autor.tipoCuenta === 'PAGE' && autor.verificado ? [...CANALES_DISPONIBLES, 'AVISOS' as const] : CANALES_DISPONIBLES;
  const requiereTitulo = canal !== 'GENERAL';
  const opcionesValidas = opciones.every((o) => o.trim()) && new Set(opciones.map((o) => o.trim().toLocaleLowerCase('es'))).size === opciones.length;
  const tieneContenido = Boolean(texto.trim() || (archivos.length > 0 && canal === 'GENERAL' && formato === 'NOTICIA'));
  const puedePublicar = tieneContenido && (!requiereTitulo || titulo.trim().length > 0)
    && (formato !== 'ENCUESTA' || opcionesValidas)
    && (formato !== 'EVENTO' || (ubicacion.trim() && fecha && new Date(fecha).getTime() > Date.now()));

  async function publicar() {
    if (enviando || !puedePublicar) return;
    setEnviando(true);
    try {
      const guardada = await onPublicar({
        texto: texto.trim(), canal, titulo: titulo.trim(), precio: precio.trim(), archivos, formato,
        opcionesEncuesta: formato === 'ENCUESTA' ? opciones.map((o) => o.trim()) : undefined,
        ubicacion: ubicacion.trim() || undefined,
        fechaEvento: formato === 'EVENTO' ? new Date(fecha).toISOString() : undefined,
      });
      if (!guardada) return;
      setTexto(''); setTitulo(''); setPrecio(''); setArchivos([]); setErrorArchivos('');
      setVersionArchivo((actual) => actual + 1);
      setFormato('NOTICIA'); setOpciones(['', '']); setUbicacion(''); setFecha('');
    } finally { setEnviando(false); }
  }

  return (
    <fieldset disabled={enviando} className="tarjeta compositor" aria-label="Crear una publicación">
      <label className="campo-publicacion">Tipo de publicación
        <select value={formato} onChange={(e) => setFormato(e.target.value as FormatoPublicacion)}>
          {Object.entries(NOMBRES_FORMATO).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
        </select>
      </label>
      <div className="compositor-fila">
        <Avatar nombre={autor.nombre} color={autor.color} tamano={44} avatarUrl={autor.avatarUrl} />
        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Comparte una duda, un proyecto o un aviso con la comunidad..."
          aria-label="Contenido de la publicación"
          maxLength={5000} rows={3}
        />
      </div>

      {formato === 'ENCUESTA' && <fieldset className="campos-encuesta">
        <legend>Opciones de la encuesta</legend>
        {opciones.map((opcion, indice) => <label key={indice} className="campo-publicacion">
          Opción {indice + 1}
          <input value={opcion} maxLength={80} onChange={(e) => setOpciones(opciones.map((valor, i) => i === indice ? e.target.value : valor))} />
        </label>)}
        {opciones.length < 6 && <button type="button" className="boton-secundario" onClick={() => setOpciones([...opciones, ''])}>Añadir opción</button>}
        {opciones.length > 2 && <button type="button" className="boton-secundario" onClick={() => setOpciones(opciones.slice(0, -1))}>Quitar última opción</button>}
      </fieldset>}
      <label className="campo-publicacion">Lugar en el campus{formato !== 'EVENTO' && ' (opcional)'}
        <input value={ubicacion} maxLength={120} placeholder="Ej. biblioteca central, sala 2" onChange={(e) => setUbicacion(e.target.value)} />
      </label>
      {formato === 'EVENTO' && <label className="campo-publicacion">Fecha y hora del evento
        <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>}
      <div className="compositor-opciones">
        <select value={canal} onChange={(evento) => setCanal(evento.target.value as Canal)} aria-label="Canal de la publicación">
          {canales.map((opcion) => <option key={opcion} value={opcion}>{NOMBRE_CANAL[opcion]}</option>)}
        </select>


        {canal === 'MERCADO' && <input value={precio} onChange={(evento) => setPrecio(evento.target.value.replace(/[^0-9]/g, ''))} placeholder="Precio en COP" inputMode="numeric" aria-label="Precio en COP" className="campo-precio" />}

        <span className="compositor-sede"><Icono nombre="ubicacion" tamano={15} />{autor.etiquetaSede ?? nombreDeSede(autor.sede)}</span>

        <label className="boton-secundario" style={{ cursor: 'pointer' }}>Añadir fotos, videos o PDF<input multiple key={versionArchivo} type="file" accept="image/*,video/*,application/pdf,.heic,.heif,.mkv,.avi,.mov,.pdf" hidden onChange={evento => {
          const nuevos = Array.from(evento.target.files ?? []);
          evento.target.value = '';
          if (archivos.length + nuevos.length > 4) { setErrorArchivos('Puedes adjuntar hasta cuatro archivos.'); return; }
          setErrorArchivos(''); setArchivos([...archivos, ...nuevos]);
        }} /></label>

        <button type="button" className="boton-primario" onClick={publicar} disabled={!puedePublicar}>{enviando ? 'Publicando…' : 'Publicar'}</button>
      </div>
      <div>{archivos.map((archivo, i) => <div key={i}><VistaPreviaAdjunto archivo={archivo} /><small>{archivo.name}</small> <button type="button" aria-label={'Quitar ' + archivo.name} onClick={() => setArchivos(archivos.filter((_, indice) => indice !== i))}>Quitar</button></div>)}
        {errorArchivos && <p role="alert">{errorArchivos}</p>}</div>

      {requiereTitulo && <input value={titulo} onChange={(evento) => setTitulo(evento.target.value)} placeholder="Título de la publicación" aria-label="Título de la publicación" className="campo-titulo" />}
    </fieldset>
  );
}
