'use client';

import { useState } from 'react';
import {
  NOMBRE_CANAL, NOMBRES_FORMATO, type AutorSocial,
  nombreDeSede,
  type ComentarioSocial,
  type PublicacionSocial,
} from '@/datos/modelos-sociales';
import { Avatar, InsigniaVerificado } from '@/componentes_compartidos/comunes/avatar';
import { Icono } from '@/componentes_compartidos/comunes/iconos';

export function TarjetaPublicacion({
  publicacion,
  reaccionado,
  likes,
  siguiendo,
  onLike,
  onReaccion,
  reaccionTipo,
  dislikes = 0,
  reaccionesPorTipo = {},
  onSeguir,
  onComentar,
  onCargarComentarios,
  onReportar,
  modoModeracion = false,
  onAccionModeracion, onVerificarPagina,
  actor, onVotar, onAceptar, onEditar, onRetirar, onCompartir, onGuardar, guardada,
}: {
  publicacion: PublicacionSocial;
  reaccionado: boolean;
  likes: number;
  siguiendo: boolean;
  onLike: () => void;
  onReaccion?: (tipo: 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED') => void;
  reaccionTipo?: 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED' | null;
  dislikes?: number;
  reaccionesPorTipo?: Partial<Record<'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED', number>>;
  onSeguir: () => void;
  onComentar?: (texto: string) => Promise<ComentarioSocial | null>;
  onCargarComentarios?: () => Promise<ComentarioSocial[]>;
  onReportar?: (tipo: 'POST' | 'USER' | 'COMMENT', objetivoId: string, motivo: string, detalle: string) => Promise<void>;
  modoModeracion?: boolean;
  onVerificarPagina?: (verificada: boolean) => Promise<void>;
  onAccionModeracion?: (accion: 'OCULTAR' | 'BANEAR', usuarioId: string) => Promise<void>;
  actor: AutorSocial;
  onVotar: (opcion: number) => Promise<void>;
  onAceptar: (comentarioId: string) => Promise<void>;
  onEditar: (contenido: string) => Promise<void>;
  onRetirar: () => Promise<void>;
  onCompartir: () => Promise<void>;
  onGuardar: () => Promise<void>;
  guardada: boolean;
}) {
  const [comentarios, setComentarios] = useState<ComentarioSocial[]>(publicacion.comentarios);
  const [mostrarComentarios, setMostrarComentarios] = useState(publicacion.comentarios.length > 0);
  const [textoComentario, setTextoComentario] = useState('');
  const [cargandoComentarios, setCargandoComentarios] = useState(false);
  const [comentariosCargados, setComentariosCargados] = useState(publicacion.comentarios.length > 0 || !onCargarComentarios);
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [motivoReporte, setMotivoReporte] = useState('OTRO');
  const [detalleReporte, setDetalleReporte] = useState('');
  const [comentarioReportado, setComentarioReportado] = useState('');
  const [tipoReporte, setTipoReporte] = useState<'POST' | 'USER' | 'COMMENT'>('POST');
  const [menuAbierto, setMenuAbierto] = useState(false);

  const esAutor = publicacion.autor.id === actor.id;
  const [editando, setEditando] = useState(false);
  const [edicion, setEdicion] = useState(publicacion.contenido);
  const [ocupada, setOcupada] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const esPregunta = publicacion.formato === 'PREGUNTA';
  const esForo = publicacion.formato === 'FORO';

  async function ejecutar(accion: () => Promise<void>, confirmacion = '') {
    if (ocupada) return;
    setOcupada(true); setMensaje('');
    try { await accion(); setMensaje(confirmacion); }
    catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo completar la acción.'); }
    finally { setOcupada(false); }
  }

  async function alternarComentarios() {
    if (!mostrarComentarios && onCargarComentarios && !comentariosCargados) {
      setCargandoComentarios(true);
      try {
        setComentarios(await onCargarComentarios());
        setComentariosCargados(true);
      } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudieron cargar las respuestas.'); return; }
      finally { setCargandoComentarios(false); }
    }
    setMostrarComentarios((visible) => !visible);
  }

  async function enviarComentario() {
    const texto = textoComentario.trim();
    if (!texto) return;
    if (onComentar) {
      const comentario = await onComentar(texto);
      if (!comentario) return;
      setComentarios((actuales) => [...actuales, comentario]);
      setComentariosCargados(true);
      setTextoComentario('');
      setMostrarComentarios(true);
      return;
    }

  }

  return (
    <article id={'publicacion-' + publicacion.id} className={`tarjeta publicacion${publicacion.fijado ? ' publicacion-fijada' : ''}`}>
      {publicacion.fijado && (
        <div className="aviso-fijado">
          <Icono nombre="fijado" tamano={14} />
          Aviso fijado por la sede
        </div>
      )}

      <header className="publicacion-cabecera">
        <Avatar nombre={publicacion.autor.nombre} color={publicacion.autor.color} tamano={46} avatarUrl={publicacion.autor.avatarUrl} />
        <div className="publicacion-autor">
          <div className="linea-nombre">
            <strong>{publicacion.autor.nombre}</strong>
            {publicacion.autor.etiquetaPerfil && <span className="badge-rol">{publicacion.autor.etiquetaPerfil}</span>}
            {publicacion.autor.verificado && <InsigniaVerificado />}
            <span className={`chip-canal canal-${publicacion.canal.toLowerCase()}`}>
              {NOMBRE_CANAL[publicacion.canal]}
            </span>
          </div>
          <span className="publicacion-meta">
            {publicacion.autor.usuario} · {publicacion.autor.etiquetaSede ?? nombreDeSede(publicacion.autor.sede)} ·{' '}
            {publicacion.autor.programa}
          </span>
          <span className="publicacion-fecha">{publicacion.fecha}</span>
        </div>

        {!modoModeracion && !esAutor && (
          <button
            type="button"
            className={`boton-seguir${siguiendo ? ' siguiendo' : ''}`}
            onClick={onSeguir}
          >
            {siguiendo ? 'Siguiendo' : 'Seguir'}
          </button>
        )}
        <div className="menu-publicacion-contenedor">
          <button type="button" className="boton-icono" aria-label="Más opciones" aria-expanded={menuAbierto} onClick={() => setMenuAbierto((abierto) => !abierto)}>
            <Icono nombre="mas" tamano={18} />
          </button>
          {menuAbierto && <div className="menu-publicacion tarjeta" role="menu">
            {!modoModeracion && esAutor && <>
              <button role="menuitem" type="button" onClick={() => { setEdicion(publicacion.contenido); setEditando(true); setMenuAbierto(false); }}>Editar publicación</button>
              <button role="menuitem" type="button" onClick={() => { setMenuAbierto(false); if (window.confirm('¿Retirar esta publicación del muro?')) void ejecutar(onRetirar); }}>Retirar publicación</button>
            </>}
            {modoModeracion ? <>
              {onVerificarPagina && <button role="menuitem" disabled={ocupada} onClick={() => {
                setMenuAbierto(false);
                void ejecutar(() => onVerificarPagina(!publicacion.autor.verificado));
              }}>{publicacion.autor.verificado ? 'Retirar verificación' : 'Verificar página'}</button>}
              <button type="button" role="menuitem" onClick={async () => { if (window.confirm('¿Ocultar esta publicación? Se conservará el registro de moderación.')) { await onAccionModeracion?.('OCULTAR', publicacion.autor.id); setMenuAbierto(false); } }}>Ocultar publicación</button>
              {!publicacion.paginaId && <button type="button" role="menuitem" disabled={esAutor || publicacion.autor.tipoCuenta === 'PAGE'} onClick={async () => { if (!esAutor && publicacion.autor.tipoCuenta !== 'PAGE' && window.confirm(`¿Banear a @${publicacion.autor.usuario} durante 30 días por incumplimiento?`)) { await onAccionModeracion?.('BANEAR', publicacion.autor.id); setMenuAbierto(false); } }}>Banear autor · 30 días</button>}
            </> : onReportar ? <>
              <button type="button" role="menuitem" onClick={() => { setTipoReporte('POST'); setMostrarReporte(true); setMenuAbierto(false); }}>Reportar publicación</button>
              <button type="button" role="menuitem" onClick={() => { setTipoReporte('USER'); setMostrarReporte(true); setMenuAbierto(false); }}>Reportar autor</button>
            </> : null}
          </div>}
        </div>
      </header>

      {mostrarReporte && onReportar && <div className="bloque-reporte"><strong>{tipoReporte === 'COMMENT' ? 'Reportar comentario' : tipoReporte === 'USER' ? 'Reportar autor' : 'Reportar publicación'}</strong><label>Motivo<select value={motivoReporte} onChange={(e) => setMotivoReporte(e.target.value)}><option value="SPAM">Spam</option><option value="ACOSO">Acoso</option><option value="CONTENIDO_INAPROPIADO">Contenido inapropiado</option><option value="FRAUDE">Fraude</option><option value="SUPLANTACION">Suplantación</option><option value="OTRO">Otro</option></select></label><input maxLength={500} value={detalleReporte} onChange={(e) => setDetalleReporte(e.target.value)} placeholder="Describe el problema (opcional)"/><button type="button" className="boton-secundario" onClick={async () => { await onReportar(tipoReporte, tipoReporte === 'COMMENT' ? comentarioReportado : tipoReporte === 'USER' ? publicacion.autor.id : publicacion.id, motivoReporte, detalleReporte); setMostrarReporte(false); setDetalleReporte(''); }}>Enviar reporte</button></div>}

      {publicacion.titulo && <h3 className="publicacion-titulo">{publicacion.titulo}</h3>}
      {publicacion.formato && publicacion.formato !== 'NOTICIA' && <strong>{NOMBRES_FORMATO[publicacion.formato]}</strong>}
      {editando ? <div className="edicion-publicacion">
        <textarea aria-label="Editar contenido" value={edicion} maxLength={5000} onChange={(e) => setEdicion(e.target.value)} />
        <button type="button" className="boton-primario" disabled={ocupada || (!edicion.trim() && !(publicacion.archivos?.length && publicacion.canal === 'GENERAL' && (publicacion.formato ?? 'NOTICIA') === 'NOTICIA'))} onClick={() => void ejecutar(async () => { await onEditar(edicion.trim()); setEditando(false); })}>Guardar cambios</button>
        <button type="button" className="boton-secundario" onClick={() => setEditando(false)}>Cancelar</button>
      </div> : <p className="publicacion-contenido">{publicacion.contenido}</p>}
      {publicacion.ubicacion && <p><Icono nombre="ubicacion" tamano={16} /> {publicacion.ubicacion} · {publicacion.autor.etiquetaSede ?? nombreDeSede(publicacion.autor.sede)}</p>}
      {publicacion.fechaEvento && <p><time dateTime={publicacion.fechaEvento}>{new Date(publicacion.fechaEvento).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</time></p>}
      {publicacion.formato === 'ENCUESTA' && <div className="encuesta-publicacion" role="group" aria-label="Opciones y resultados de la encuesta">
        {publicacion.opcionesEncuesta?.map((opcion, i) => <button key={i} type="button" className="boton-secundario"
          disabled={ocupada || modoModeracion} aria-pressed={publicacion.resultadoEncuesta?.miOpcion === i}
          onClick={() => void ejecutar(() => onVotar(i))}>
          <span>{opcion}{publicacion.resultadoEncuesta?.miOpcion === i ? ' ✓' : ''}</span>
          <span>{publicacion.resultadoEncuesta?.totales[i] ?? 0} votos</span>
        </button>)}
      </div>}
      {mensaje && <p role="status">{mensaje}</p>}

      {publicacion.archivos?.map((archivo) => (
        <div className="publicacion-adjunto" key={archivo.url}>
          {archivo.mime.startsWith('image/') ? <img src={archivo.url} alt={archivo.nombre} loading="lazy" /> : archivo.mime.startsWith('video/') ? <video src={archivo.url} controls preload="metadata" /> : <a href={archivo.url} target="_blank" rel="noreferrer">📄 {archivo.nombre}</a>}
        </div>
      ))}

      {publicacion.media && (
        <div className={`publicacion-media tono-${publicacion.media.tono}`}>
          <div className="media-icono">
            <Icono
              nombre={publicacion.canal === 'ACADEMICO' ? 'codigo' : 'ubicacion'}
              tamano={30}
            />
          </div>
          <div>
            <strong>{publicacion.media.titulo}</strong>
            <span>{publicacion.media.detalle}</span>
          </div>
        </div>
      )}

      {publicacion.mercado && (
        <div className="bloque-mercado">
          <div>
            <span className="mercado-etiqueta">Mercado Poli</span>
            <strong>{publicacion.mercado.precio}</strong>
          </div>
          <span
            className={`mercado-estado${
              publicacion.mercado.estado === 'Vendido' ? ' vendido' : ''
            }`}
          >
            {publicacion.mercado.estado}
          </span>
        </div>
      )}

      {publicacion.resuelto && (
        <div className="etiqueta-resuelto">
          <Icono nombre="verificado" tamano={15} />
          Respuesta solucionada
        </div>
      )}

      {publicacion.etiquetas.length > 0 && (
        <div className="etiquetas">
          {publicacion.etiquetas.map((etiqueta) => (
            <span key={etiqueta} className="etiqueta">
              #{etiqueta}
            </span>
          ))}
        </div>
      )}

      <footer className={`publicacion-acciones${modoModeracion ? ' solo-lectura' : ''}`}>
        {modoModeracion ? <span className="accion" aria-label={`${likes} reacciones positivas y ${dislikes} negativas`}>♥ {likes} · ⊖ {dislikes}</span> : <>
        <button
          type="button"
          className={`accion${reaccionado ? ' activa' : ''}`}
          onClick={onLike}
          aria-pressed={reaccionado}
        >
          <span aria-hidden="true">{reaccionTipo === 'LOVE' ? '🧡' : reaccionTipo === 'FUN' ? '😹' : reaccionTipo === 'AMAZED' ? '✨' : '♥'}</span>
          {likes}
        </button>
        {onReaccion && <div className="selector-reacciones" aria-label="Reacciones">
          {([['LIKE','✦','Me gusta'],['DISLIKE','⊖','No me gusta'],['LOVE','🧡','Me encanta'],['FUN','😹','Me divierte'],['AMAZED','✨','Me asombra']] as const).map(([tipo, emoji, etiqueta]) =>
            <button key={tipo} type="button" title={etiqueta} aria-label={`${etiqueta}: ${tipo === 'DISLIKE' ? dislikes : reaccionesPorTipo[tipo] ?? 0}`} aria-pressed={reaccionTipo === tipo} onClick={() => onReaccion(tipo)}>{emoji}<small>{tipo === 'DISLIKE' ? dislikes : reaccionesPorTipo[tipo] ?? 0}</small></button>
          )}
        </div>}
        </>}
        <button
          type="button"
          className={`accion${mostrarComentarios ? ' activa' : ''}`}
          onClick={() => void alternarComentarios()}
        >
          <Icono nombre="comentario" tamano={19} />
          {esPregunta ? 'Respuestas ' : esForo ? 'Intervenciones ' : ''}{Math.max(comentarios.length, publicacion.comentariosCount ?? 0)}
        </button>
        {!modoModeracion && <button type="button" className="accion" onClick={() => void ejecutar(onCompartir, 'Enlace copiado.')}>
          <Icono nombre="compartir" tamano={19} />
          Compartir
        </button>}
        {!modoModeracion && <button type="button" className="accion accion-guardar" aria-pressed={guardada} aria-label={guardada ? 'Quitar de guardados' : 'Guardar publicación'} onClick={() => void ejecutar(onGuardar)}>
          <Icono nombre="guardar" tamano={19} />
        </button>}
      </footer>

      {mostrarComentarios && (
        <section className="comentarios">
          {cargandoComentarios && <p>Cargando comentarios…</p>}
          {comentarios.map((comentario) => (
            <div
              key={comentario.id}
              className={`comentario${comentario.solucion ? ' comentario-solucion' : ''}`}
            >
              <Avatar
                nombre={comentario.autor.nombre}
                color={comentario.autor.color}
                tamano={32}
              />
              <div className="comentario-cuerpo">
                <div className="comentario-cabecera">
                  <strong>{comentario.autor.nombre}</strong>
                  {comentario.autor.verificado && <InsigniaVerificado tamano={13} />}
                  {comentario.solucion && <span className="marca-solucion">Solución</span>}
                  <span>{comentario.fecha}</span>
                </div>
                <p>{comentario.texto}</p>
                {onReportar && comentario.autor.id !== actor.id && <button type="button" onClick={() => {
                  setTipoReporte('COMMENT'); setComentarioReportado(comentario.id); setMostrarReporte(true);
                }}>Reportar comentario</button>}
                {!modoModeracion && esAutor && (esPregunta || publicacion.canal === 'ACADEMICO') && !comentario.solucion &&
                <button type="button" className="boton-secundario" disabled={ocupada} onClick={() => void ejecutar(async () => {
                  await onAceptar(comentario.id);
                  setComentarios((actuales) => actuales.map((c) => ({ ...c, solucion: c.id === comentario.id })));
                })}>Aceptar respuesta</button>}
              </div>
            </div>
          ))}

          {!modoModeracion && <div className="comentario-nuevo">
            <Avatar nombre={actor.nombre} color={actor.color} tamano={32} avatarUrl={actor.avatarUrl} />
            <input
              value={textoComentario}
              onChange={(evento) => setTextoComentario(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') void enviarComentario();
              }}
              placeholder={esPregunta ? 'Escribe una respuesta…' : esForo ? 'Participa en el debate…' : 'Escribe un comentario…'}
              aria-label="Escribe un comentario"
            />
            <button
              type="button"
              className="boton-enviar-comentario"
              onClick={() => void enviarComentario()}
              disabled={!textoComentario.trim()}
            >
              <Icono nombre="enviar" tamano={17} />
            </button>
          </div>}
        </section>
      )}
    </article>
  );
}
