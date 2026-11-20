'use client';

import { CampoBusqueda } from '@/componentes_compartidos/comunes/campo-busqueda';
import { useCallback, useEffect, useState } from 'react';
import { type Usuario, type ChatApi } from '@/servicios/api-cliente';
import { EncabezadoVista } from '@/modulos/inicio/vistas/encabezado-vista';
import { ModalCrearComunidad } from './modal-crear-comunidad';
import { INFORMACION_ACCESO, NOMBRES_CATEGORIAS, type Comunidad, type TipoAccesoComunidad } from '../servicios/datos-comunidades';
import { alternarMembresiaApi, crearChatComunidadApi, crearComunidadApi, listarComunidadesApi, listarSolicitudesComunidadApi, resolverSolicitudComunidadApi, invitarComunidad } from '../servicios/comunidades-api';

function adaptar(d: Record<string, unknown>): Comunidad {
  return {
    ...d, id: String(d._id), nombre: String(d.nombre), descripcion: String(d.descripcion),
    sede: String(d.sede), nombreSede: String(d.nombreSede ?? d.sede), categoria: d.categoria as Comunidad['categoria'],
    tipoAcceso: d.tipoAcceso as TipoAccesoComunidad, miembrosCount: Number(d.miembrosCount),
    creadorId: String(d.creadorId), creadorNombre: String(d.creadorNombre), color: String(d.color), creadoEn: String(d.creadoEn),
    esMiembro: Boolean(d.esMiembro), solicitudPendiente: Boolean(d.solicitudPendiente), invitacionPendiente: Boolean(d.invitacionPendiente),
    solicitudesCount: Number(d.solicitudesCount ?? 0), chatIdAsociado: typeof d.chatIdAsociado === 'string' ? d.chatIdAsociado : undefined,
    reglas: Array.isArray(d.reglas) ? d.reglas.map(String) : [],
  };
}

import { buscarCoincidencias } from "@/servicios/coincidencias";
export function PanelComunidades({ token, usuario, contactos, consulta, cambiar, alAbrirChat, alSalirChat }: {
  token: string; usuario: Usuario; contactos: Usuario[]; consulta: string; cambiar:(v:string)=>void;
  alAbrirChat: (chat: ChatApi) => void; alSalirChat: (id: string) => void;
}) {
  const [lista, setLista] = useState<Comunidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [alcance, setAlcance] = useState('TODAS');
  const [acceso, setAcceso] = useState('TODOS');
  const [solicitudes, setSolicitudes] = useState<Record<string, Usuario[]>>({});
  const [invitado, setInvitado] = useState<Record<string, string>>({});
  const [ocupada, setOcupada] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => {
    const { comunidades } = await listarComunidadesApi(token);
    setLista(comunidades.map(adaptar));
  }, [token]);
  useEffect(() => { void cargar().catch((e) => setMensaje(e.message)).finally(()=>setCargando(false)); }, [cargar]);

  async function ejecutar(accion: () => Promise<void>) {
    if (ocupada) return;
    setOcupada(true); setMensaje('');
    try { await accion(); }
    catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo completar la operación.'); }
    finally { setOcupada(false); }
  }
  async function revisar(id: string) {
    const r = await listarSolicitudesComunidadApi(id, token);
    setSolicitudes((s) => ({ ...s, [id]: r.usuarios }));
  }

  const candidatas = lista.filter((c) =>
    (alcance !== 'PROPIAS' || c.esMiembro) && (alcance !== 'SEDE' || c.sede === usuario.campus || c.sede === 'GLOBAL') &&
    (alcance !== 'INVITADAS' || c.invitacionPendiente) && (acceso === 'TODOS' || c.tipoAcceso === acceso));
  const filtradas = buscarCoincidencias(candidatas,consulta,c=>c.nombre,c=>NOMBRES_CATEGORIAS[c.categoria]);
  return <>
    <EncabezadoVista titulo="Comunidades y semilleros" subtitulo="Encuentra grupos de tu sede y participa en sus conversaciones."
      accion={<button className="boton-primario" onClick={() => setModal(true)}>Crear comunidad</button>} />
    <section className="tarjeta explorar-comunidades" aria-label="Buscar y filtrar comunidades">
      <CampoBusqueda etiqueta="Buscar comunidades" placeholder="Buscar por nombre o categoría" texto={consulta} cambiar={cambiar} />
      <div className="grupo-filtros" role="group" aria-label="Alcance">
        {Object.entries({TODAS:'Todas',SEDE:'Mi sede',PROPIAS:'Mis grupos',INVITADAS:'Mis invitaciones'}).map(([k,v])=><button key={k} className="chip-filtro" aria-pressed={alcance===k} onClick={()=>setAlcance(k)}>{v}</button>)}
      </div>
      <details className="filtros-acceso"><summary>Tipo de acceso · {acceso === 'TODOS' ? 'Todos' : INFORMACION_ACCESO[acceso as TipoAccesoComunidad].titulo}</summary>
        <div className="grupo-filtros">{Object.entries({TODOS:'Todos',...Object.fromEntries(Object.entries(INFORMACION_ACCESO).map(([k,v])=>[k,v.titulo]))}).map(([k,v])=><button key={k} className="chip-filtro" aria-pressed={acceso===k} onClick={()=>setAcceso(k)}>{v}</button>)}</div>
      </details>
      <small role="status">{cargando ? 'Cargando comunidades…' : filtradas.length + (filtradas.length === 1 ? ' comunidad' : ' comunidades')}</small>
    </section>
    {mensaje && <p role="status">{mensaje}</p>}
    <div className="grid-comunidades">{filtradas.map((c) => {
      const propia = c.creadorId === usuario._id;
      const acceso = INFORMACION_ACCESO[c.tipoAcceso];
      const textoMembresia = c.esMiembro ? 'Abandonar grupo' : c.invitacionPendiente ? 'Aceptar invitación' :
        c.solicitudPendiente ? 'Cancelar solicitud' : c.tipoAcceso === 'APROBACION' ? 'Solicitar ingreso' : 'Unirme';
      return <article key={c.id} className="tarjeta-comunidad"><div className="comunidad-cuerpo">
        <h3>{c.nombre}</h3><small>{NOMBRES_CATEGORIAS[c.categoria]}</small><p>{c.descripcion}</p>
        <div className="comunidad-meta-fila"><span>{c.sede === 'GLOBAL' ? 'Todo el Poli' : c.nombreSede}</span></div>
        <p>{acceso.titulo} · {c.miembrosCount} miembros · Creada por {c.creadorNombre}</p>
        {Boolean(c.reglas?.length) && <details><summary>Normas del grupo</summary><ul>{c.reglas!.map((r, i) => <li key={i}>{r}</li>)}</ul></details>}
        {propia ? <span>Administras este grupo</span> : <button type="button" className="boton-secundario" disabled={ocupada}
          onClick={() => void ejecutar(async () => { await alternarMembresiaApi(c.id, token); if (c.esMiembro && c.chatIdAsociado) alSalirChat(c.chatIdAsociado); await cargar(); })}>
          {textoMembresia}</button>}
        {c.esMiembro && (c.chatIdAsociado || propia) && <button type="button" className="boton-secundario" disabled={ocupada}
          onClick={() => void ejecutar(async () => alAbrirChat((await crearChatComunidadApi(c.id, token)).chat))}>{c.chatIdAsociado ? 'Abrir chat' : 'Crear chat'}</button>}
        {propia && <details><summary>Administrar miembros</summary>
          <label>Invitar persona <select value={invitado[c.id] ?? ''} onChange={(e) => setInvitado({ ...invitado, [c.id]: e.target.value })}>
            <option value="">Seleccionar persona</option>
            {contactos.filter((u) => u._id !== usuario._id).map((u) => <option key={u._id} value={u._id}>{u.displayName} · @{u.username}</option>)}
          </select></label>
          <button type="button" disabled={ocupada || !invitado[c.id]} onClick={() => void ejecutar(async () => {
            await invitarComunidad(c.id, invitado[c.id], token); setInvitado({ ...invitado, [c.id]: '' }); setMensaje('Invitación enviada.');
          })}>Enviar invitación</button>
          {c.tipoAcceso === 'APROBACION' && <button type="button" disabled={ocupada} onClick={() => void ejecutar(() => revisar(c.id))}>Solicitudes ({c.solicitudesCount})</button>}
          {solicitudes[c.id]?.map((u) => <p key={u._id}>{u.displayName} · @{u.username} {([true, false] as const).map((aprobar) =>
            <button type="button" key={String(aprobar)} disabled={ocupada} onClick={() => void ejecutar(async () => {
              await resolverSolicitudComunidadApi(c.id, u._id, aprobar, token); await revisar(c.id); await cargar();
            })}>{aprobar ? 'Aceptar' : 'Rechazar'}</button>)}</p>)}
        </details>}
      </div></article>;
    })}</div>
    {!cargando && !mensaje && !filtradas.length && <section className="tarjeta vacio-directorio">
      {lista.length ? <><strong>Sin coincidencias</strong><button className="boton-secundario" onClick={()=>{cambiar('');setAlcance('TODAS');setAcceso('TODOS');}}>Restablecer búsqueda y filtros</button></> : <strong>Aún no hay comunidades disponibles para tu cuenta.</strong>}
    </section>}
    {modal && <ModalCrearComunidad abierto sedeActual={usuario.campus} onCerrar={() => setModal(false)}
      onCrear={async (datos) => {
        const comunidad = adaptar(await crearComunidadApi(datos, token));
        setAlcance('TODAS'); setAcceso('TODOS'); setLista((actuales) => [comunidad, ...actuales]);
      }} />}
  </>;
}
