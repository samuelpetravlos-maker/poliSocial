'use client';

import { useState, useEffect } from 'react';
import { listarCatalogosPublicosApi, type Sede } from '@/servicios/api-cliente';
import {
  CategoriaComunidad,
  INFORMACION_ACCESO,
  NOMBRES_CATEGORIAS,
  TipoAccesoComunidad,
} from '../servicios/datos-comunidades';
import { Icono } from '@/componentes_compartidos/comunes/iconos';

interface ModalCrearComunidadProps {
  abierto: boolean;
  onCerrar: () => void;
  onCrear: (datos: {
    nombre: string;
    descripcion: string;
    sede: Sede | 'GLOBAL';
    categoria: CategoriaComunidad;
    tipoAcceso: TipoAccesoComunidad;
    crearChatVinculado: boolean;
    reglas: string[];
  }) => Promise<void>;
  sedeActual: Sede;
}

export function ModalCrearComunidad({
  abierto,
  onCerrar,
  onCrear,
  sedeActual,
}: ModalCrearComunidadProps) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [sede, setSede] = useState<Sede | 'GLOBAL'>(sedeActual);
  const [categoria, setCategoria] = useState<CategoriaComunidad>('SEMILLERO');
  const [tipoAcceso, setTipoAcceso] = useState<TipoAccesoComunidad>('LIBRE');
  const [crearChatVinculado, setCrearChatVinculado] = useState(true);
  const [reglaTexto, setReglaTexto] = useState('');
  const [reglas, setReglas] = useState<string[]>([
    'Trato respetuoso y colaborativo entre compañeros del PJIC.',
  ]);

  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    let activa = true;
    listarCatalogosPublicosApi().then(({ catalogos }) => {
      if (!activa) return;
      const sedes = catalogos.filter((c) => c.tipo === 'sede' && c.activo);
      setSedes(sedes);
      setSede(sedes.some((s) => s.id === sedeActual) ? sedeActual : 'GLOBAL');
    }).catch(() => { if (activa) { setSede('GLOBAL'); setError('No se pudieron cargar las sedes.'); } });
    return () => { activa = false; };
  }, [abierto, sedeActual]);
  if (!abierto) return null;

  function agregarRegla() {
    const texto = reglaTexto.trim();
    if (texto && !reglas.includes(texto)) {
      setReglas([...reglas, texto]);
      setReglaTexto('');
    }
  }

  function eliminarRegla(indice: number) {
    setReglas(reglas.filter((_, i) => i !== indice));
  }

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !descripcion.trim()) return;

    if (creando) return;
    setCreando(true); setError('');
    try { await onCrear({
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      sede,
      categoria,
      tipoAcceso,
      crearChatVinculado,
      reglas,
    });

    onCerrar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la comunidad.'); }
    finally { setCreando(false); }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-contenedor tarjeta modal-comunidad" onClick={(e) => e.stopPropagation()}>
        <header className="modal-encabezado">
          <div className="modal-marca">
            <span className="logo-circulo-modal">
              <Icono nombre="personas" tamano={22} />
            </span>
            <div>
              <h3>Nueva Comunidad o Grupo</h3>
              <p>Crea un espacio de estudio, semillero o interés estudiantil</p>
            </div>
          </div>
          <button
            type="button"
            className="boton-cerrar-modal"
            onClick={onCerrar}
            aria-label="Cerrar ventana"
          >
            <Icono nombre="cerrar" tamano={20} />
          </button>
        </header>

        <form onSubmit={manejarSubmit} className="formulario-auth">
          {/* Nombre */}
          <div className="campo-auth">
            <label htmlFor="com-nombre">Nombre de la comunidad o grupo</label>
            <div className="input-con-icono">
              <Icono nombre="personas" tamano={18} />
              <input
                id="com-nombre"
                type="text"
                placeholder="ej. Semillero CodePoli Urabá o Club de Robótica"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                required
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="campo-auth">
            <label htmlFor="com-desc">Propósito y descripción</label>
            <textarea
              id="com-desc"
              className="textarea-comunidad"
              placeholder="Explica de qué trata el grupo, qué actividades realizarán y quiénes pueden participar..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              maxLength={300}
              required
            />
            <small className="texto-pista">Máximo 300 caracteres.</small>
          </div>

          {/* Sede y Categoría */}
          <div className="grid-dos-campos">
            <div className="campo-auth">
              <label htmlFor="com-sede">Alcance o Sede</label>
              <div className="input-con-icono">
                <Icono nombre="ubicacion" tamano={18} />
                <select
                  id="com-sede"
                  value={sede}
                  onChange={(e) => setSede(e.target.value as Sede | 'GLOBAL')}
                >
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  <option value="GLOBAL">🌐 Todas las Sedes (Global Poli)</option>
                </select>
              </div>
            </div>

            <div className="campo-auth">
              <label htmlFor="com-cat">Categoría</label>
              <div className="input-con-icono">
                <Icono nombre="graduacion" tamano={18} />
                <select
                  id="com-cat"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as CategoriaComunidad)}
                >
                  {Object.entries(NOMBRES_CATEGORIAS).map(([clave, etiqueta]) => (
                    <option key={clave} value={clave}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TIPO DE ACCESO (Libre, Por Aprobación, Por Invitación) */}
          <div className="campo-auth">
            <label>Tipo de acceso y privacidad</label>
            <div className="grid-tipos-acceso">
              {(['LIBRE', 'APROBACION', 'INVITACION'] as TipoAccesoComunidad[]).map((tipo) => {
                const info = INFORMACION_ACCESO[tipo];
                const seleccionado = tipoAcceso === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    className={`tarjeta-tipo-acceso ${info.clase} ${seleccionado ? 'seleccionado' : ''
                      }`}
                    onClick={() => setTipoAcceso(tipo)}
                  >
                    <div className="acceso-cabecera">
                      <Icono nombre={info.icono} tamano={20} />
                      <strong>{info.titulo}</strong>
                    </div>
                    <p>{info.descripcion}</p>
                    {seleccionado && (
                      <span className="check-seleccionado">
                        <Icono nombre="check" tamano={14} /> Seleccionado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkbox para crear chat grupal vinculado */}
          <div className="campo-terminos">
            <label className="checkbox-terminos">
              <input
                type="checkbox"
                checked={crearChatVinculado}
                onChange={(e) => setCrearChatVinculado(e.target.checked)}
              />
              <span>
                <strong>Chat grupal de la comunidad</strong>. Se podrá abrir cuando haya al menos
                tres miembros; los nuevos miembros se añadirán al chat automáticamente.
              </span>
            </label>
          </div>

          {/* Reglas de la comunidad */}
          <div className="campo-auth">
            <label>Normas del grupo (opcional)</label>
            <div className="input-con-icono">
              <Icono nombre="escudo" tamano={18} />
              <input
                type="text"
                placeholder="Añadir una norma (ej. Asistencia a semilleros)"
                value={reglaTexto}
                onChange={(e) => setReglaTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarRegla();
                  }
                }}
              />
              <button type="button" className="boton-agregar-regla" onClick={agregarRegla}>
                Añadir
              </button>
            </div>

            {reglas.length > 0 && (
              <ul className="lista-reglas-crear">
                {reglas.map((regla, i) => (
                  <li key={i}>
                    <span>• {regla}</span>
                    <button
                      type="button"
                      className="boton-eliminar-regla"
                      onClick={() => eliminarRegla(i)}
                      aria-label="Quitar norma"
                    >
                      <Icono nombre="cerrar" tamano={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p role="alert">{error}</p>}
          <button
            type="submit"
            className="boton-primario boton-bloque"
            disabled={creando || nombre.trim().length < 3 || descripcion.trim().length < 3}
          >
            {creando ? 'Creando…' : 'Crear comunidad'}
          </button>
        </form>
      </div>
    </div>
  );
}
