'use client';

import { cambiarAccesoCategoria } from '@/servicios/api-cliente';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  cambiarEstadoCatalogoAdminApi,
  crearElementoCatalogoAdminApi,
  listarCatalogosAdminApi,
  type ElementoCatalogoAdministrativo,
  type TipoCatalogoAdministrativo,
} from '../servicios/servicio-api';

const TIPOS: Array<{ id: TipoCatalogoAdministrativo; titulo: string; descripcion: string }> = [
  { id: 'perfil', titulo: 'Perfiles de cuenta', descripcion: 'Etiquetas como estudiante y profesor. El permiso de acceso se configura por separado.' },
  { id: 'programa', titulo: 'Carreras y programas', descripcion: 'Opciones que se asignan a las cuentas por sede.' },
  { id: 'sede', titulo: 'Sedes', descripcion: 'Ubicaciones disponibles para cuentas y programas.' },
  { id: 'categoria_pagina', titulo: 'Categorías de páginas', descripcion: 'Clasificaciones para páginas institucionales.' },
];

export function CatalogosAdministracion({ token }: { token: string }) {
  const [elementos, setElementos] = useState<ElementoCatalogoAdministrativo[]>([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setError(''); setElementos((await listarCatalogosAdminApi(token)).catalogos); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudieron cargar los catálogos.'); }
    finally { setCargando(false); }
  }, [token]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function crear(tipo: TipoCatalogoAdministrativo, datos: Record<string, unknown>, evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    setGuardando(true); setError(''); setMensaje('');
    try {
      await crearElementoCatalogoAdminApi(tipo, datos, token);
      setMensaje('Registro creado y disponible en las listas.');
      formulario.reset();
      await cargar();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear el registro.'); }
    finally { setGuardando(false); }
  }

  async function cambiarEstado(elemento: ElementoCatalogoAdministrativo) {
    try {
      setError(''); setMensaje('');
      await cambiarEstadoCatalogoAdminApi(elemento.tipo, elemento.id, !elemento.activo, token);
      setMensaje(elemento.activo ? 'Registro inhabilitado. Se conserva en la base de datos.' : 'Registro habilitado.');
      await cargar();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.'); }
  }

  const sedesActivas = elementos.filter((elemento) => elemento.tipo === 'sede' && elemento.activo);

  return <div className="admin-panel">
    <section className="tarjeta admin-aviso-catalogos">
      <strong>Los registros no se eliminan</strong>
      <span>Al inhabilitar un elemento, deja de ofrecerse en nuevas cuentas y formularios. Las cuentas existentes y sus referencias se conservan.</span>
    </section>
    {error && <div className="mensaje-error-auth" role="alert">{error}</div>}
    {mensaje && <div className="admin-mensaje" role="status">{mensaje}</div>}

    {TIPOS.map((grupo) => <section className="tarjeta admin-lista admin-catalogo" key={grupo.id}>
      <header className="admin-lista-encabezado"><div><h2>{grupo.titulo}</h2><p>{grupo.descripcion}</p></div></header>

      {grupo.id === 'perfil' && <form className="admin-campos admin-catalogo-formulario" onSubmit={(evento) => {
        const datos = new FormData(evento.currentTarget);
        void crear('perfil', { nombre: datos.get('nombre'), tipoBase: datos.get('tipoBase') }, evento);
      }}>
        <label>Nombre visible<input name="nombre" required maxLength={80} placeholder="Por ejemplo, Egresado" /></label>
        <label>Se comporta como<select name="tipoBase"><option value="STUDENT">Estudiante</option><option value="TEACHER">Profesor</option><option value="PAGE">Página institucional</option></select></label>
        <button type="submit" className="boton-secundario" disabled={guardando}>Añadir perfil</button>
      </form>}

      {grupo.id === 'programa' && <form className="admin-campos admin-catalogo-formulario" onSubmit={(evento) => {
        const datos = new FormData(evento.currentTarget);
        const sedes = Array.from(evento.currentTarget.querySelectorAll<HTMLInputElement>('input[name="sedes"]:checked')).map((entrada) => entrada.value);
        void crear('programa', { nombre: datos.get('nombre'), facultad: datos.get('facultad'), semestres: datos.get('semestres'), sedes }, evento);
      }}>
        <label>Nombre de la carrera<input name="nombre" required maxLength={100} /></label>
        <label>Facultad<input name="facultad" required maxLength={100} /></label>
        <label>Duración en semestres<input name="semestres" type="number" required min={1} max={20} defaultValue={6} /></label>
        <fieldset className="admin-catalogo-sedes"><legend>Sedes disponibles</legend>{sedesActivas.map((sede) => <label key={sede.id}><input type="checkbox" name="sedes" value={sede.id} />{sede.nombre}</label>)}</fieldset>
        <button type="submit" className="boton-secundario" disabled={guardando || sedesActivas.length === 0}>Añadir carrera</button>
      </form>}

      {grupo.id === 'sede' && <form className="admin-campos admin-catalogo-formulario" onSubmit={(evento) => {
        const datos = new FormData(evento.currentTarget);
        void crear('sede', { nombre: datos.get('nombre'), ciudad: datos.get('ciudad') }, evento);
      }}>
        <label>Nombre de la sede<input name="nombre" required maxLength={100} /></label>
        <label>Municipio<input name="ciudad" required maxLength={80} /></label>
        <button type="submit" className="boton-secundario" disabled={guardando}>Añadir sede</button>
      </form>}

      {grupo.id === 'categoria_pagina' && <form className="admin-campos admin-catalogo-formulario" onSubmit={(evento) => {
        const datos = new FormData(evento.currentTarget);
        void crear('categoria_pagina', { nombre: datos.get('nombre'), soloPersonal: datos.has('soloPersonal') }, evento);
      }}>
        <label>Categoría<input name="nombre" required maxLength={100} placeholder="Por ejemplo, Grupo cultural" /></label>
        <label><input type="checkbox" name="soloPersonal" /> Reservar esta categoría al personal</label>
        <button type="submit" className="boton-secundario" disabled={guardando}>Añadir categoría</button>
      </form>}

      {cargando ? <p>Cargando lista…</p> : <div className="admin-catalogo-lista">
        {elementos.filter((elemento) => elemento.tipo === grupo.id).map((elemento) => <article className="admin-usuario" key={`${elemento.tipo}:${elemento.id}`}>
          <div className="admin-usuario-info"><strong>{elemento.nombre}</strong><span>{elemento.tipo === 'programa' ? `${elemento.facultad} · ${elemento.semestres} semestres` : elemento.tipo === 'sede' ? elemento.ciudad : elemento.tipo === 'perfil' ? `Perfil de ${elemento.tipoBase === 'TEACHER' ? 'profesor' : elemento.tipoBase === 'PAGE' ? 'página' : 'estudiante'}${elemento.integrado ? ' · predeterminado' : ''}` : 'Categoría institucional'}</span><small>{elemento.activo ? 'Activo' : 'Inhabilitado'}</small></div>
          {elemento.tipo === 'categoria_pagina' && <label><input type="checkbox" checked={!!elemento.soloPersonal} disabled={guardando}
            onChange={async e => {
              setGuardando(true); setError('');
              try { await cambiarAccesoCategoria(elemento.id, e.target.checked, token); await cargar(); }
              catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el permiso.'); }
              finally { setGuardando(false); }
            }} /> Reservada a administración y moderación</label>}
          <button type="button" className="boton-secundario" onClick={() => void cambiarEstado(elemento)}>{elemento.activo ? 'Inhabilitar' : 'Habilitar'}</button>
        </article>)}
        {!elementos.some((elemento) => elemento.tipo === grupo.id) && <p>Aún no hay elementos en esta lista.</p>}
      </div>}
    </section>)}
  </div>;
}
