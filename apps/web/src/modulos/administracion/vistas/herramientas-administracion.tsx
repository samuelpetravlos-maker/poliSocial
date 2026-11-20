'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RegistroAuditoriaApi, ResumenAdministracionApi, Usuario } from '@/servicios/api-cliente';
import { listarAuditoriaAdminApi, obtenerResumenAdminApi } from '../servicios/servicio-api';
import { CrearPaginaInstitucional } from '@/modulos/paginas/vistas/crear-pagina-institucional';
import { listarPaginasApi, verificarPaginaApi, type PaginaSocial } from '@/modulos/paginas/servicios/servicio-api';
import { PanelAdministracion } from './panel-administracion';
import { CatalogosAdministracion } from './catalogos-administracion';

export const SECCIONES_ADMIN = {
  resumen: 'Resumen', usuarios: 'Usuarios y permisos', moderacion: 'Reportes',
  paginas: 'Páginas', catalogos: 'Carreras y listas', auditoria: 'Auditoría',
};
export type SeccionAdmin = keyof typeof SECCIONES_ADMIN;

function nombreAccionAuditoria(accion: string, valorDetalles?: unknown) {
  const detalles = valorDetalles && typeof valorDetalles === 'object' ? valorDetalles as Record<string, unknown> : {};
  if (accion === 'CHANGE_ROLE' && detalles.tipo === 'perfil') return 'Cambió el perfil de una cuenta';
  if (accion === 'EDIT_CATALOG') return detalles.operacion === 'crear' ? 'Añadió una opción de catálogo' : detalles.operacion === 'inhabilitar' ? 'Inhabilitó una opción de catálogo' : detalles.operacion === 'habilitar' ? 'Habilitó una opción de catálogo' : 'Actualizó un catálogo';
  if (accion === 'DELETE_USER' && detalles.activo === true) return 'Habilitó una cuenta';
  const etiquetas: Record<string, string> = {
    CREATE_USER: 'Creó una cuenta', BAN_USER: 'Aplicó un baneo', UNBAN_USER: 'Retiró un baneo',
    RESET_PASSWORD: 'Restableció una contraseña', CHANGE_ROLE: 'Cambió un permiso', DELETE_USER: 'Inhabilitó una cuenta',
    VERIFY_PAGE: 'Verificó una página', REJECT_PAGE: 'Retiró la verificación', HIDE_POST: 'Ocultó una publicación',
  };
  return etiquetas[accion] ?? 'Acción administrativa';
}

function nombreObjetivoAuditoria(tipo: string) {
  const nombres: Record<string, string> = { USER: 'cuenta', POST: 'publicación', COMMENT: 'comentario', PAGE: 'página', MESSAGE: 'mensaje', SEDE: 'sede', PROGRAMA: 'carrera', PERFIL: 'perfil', CATEGORIA_PAGINA: 'categoría de página' };
  return nombres[tipo] ?? 'registro';
}

function nombreRolAdministracion(rol: string) {
  return rol === 'ADMIN' ? 'Administrador' : rol === 'MODERATOR' ? 'Moderador' : 'Usuario';
}

function describirDetallesAuditoria(valor: unknown) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return '';
  const detalles = valor as Record<string, unknown>;
  const partes: string[] = [];
  const motivos: Record<string, string> = {
    SPAM: 'Correo o contenido no solicitado', ACOSO: 'Acoso', CONTENIDO_INAPROPIADO: 'Contenido inapropiado',
    FRAUDE: 'Fraude', SUPLANTACION: 'Suplantación', INCUMPLIMIENTO: 'Incumplimiento de normas', OTRO: 'Otro motivo',
  };
  const acciones: Record<string, string> = {
    OCULTAR: 'Contenido ocultado', ELIMINAR: 'Contenido eliminado', BANEAR: 'Cuenta suspendida', NINGUNA: 'Sin medida',
  };
  if (typeof detalles.reason === 'string') partes.push(`Motivo: ${motivos[detalles.reason] ?? 'Otro motivo'}`);
  if (typeof detalles.nombre === 'string') partes.push(detalles.nombre);
  if (typeof detalles.details === 'string' && detalles.details) partes.push(detalles.details);
  if (typeof detalles.resolution === 'string' && detalles.resolution) partes.push(`Resolución: ${detalles.resolution}`);
  if (typeof detalles.accion === 'string') partes.push(acciones[detalles.accion] ?? 'Acción registrada');
  if (typeof detalles.activo === 'boolean') partes.push(detalles.activo ? 'Estado: habilitado' : 'Estado: inhabilitado');
  if (typeof detalles.days === 'number' || typeof detalles.durationDays === 'number') {
    partes.push(`Duración: ${Number(detalles.days ?? detalles.durationDays)} días`);
  }
  if (typeof detalles.from === 'string' && typeof detalles.to === 'string') {
    partes.push(detalles.tipo === 'perfil' ? `Perfil: ${detalles.from} → ${detalles.to}` : `Permiso: ${nombreRolAdministracion(detalles.from)} → ${nombreRolAdministracion(detalles.to)}`);
  }
  return partes.join(' · ') || 'Detalles registrados';
}

export function HerramientasAdministracion({ token, usuario, pestana, setPestana }: {
  token: string; usuario: Usuario; pestana: SeccionAdmin; setPestana: (vista: SeccionAdmin) => void;
}) {
  const [paginas, setPaginas] = useState<PaginaSocial[]>([]);
  const [errorPaginas, setErrorPaginas] = useState('');
  const [errorGeneral, setErrorGeneral] = useState('');
  const [resumen, setResumen] = useState<ResumenAdministracionApi | null>(null);
  const [auditoria, setAuditoria] = useState<RegistroAuditoriaApi[]>([]);
  const [menuPaginaAbierto, setMenuPaginaAbierto] = useState<string | null>(null);
  const [paginaDetalle, setPaginaDetalle] = useState<PaginaSocial | null>(null);
  const cargarPaginas = useCallback(async () => {
    try {
      setErrorPaginas('');
      setPaginas((await listarPaginasApi(token)).paginas);
    } catch (error) {
      setErrorPaginas(error instanceof Error ? error.message : 'No se pudieron cargar las páginas.');
    }
  }, [token]);
  useEffect(() => { if (pestana === 'paginas') void cargarPaginas(); }, [cargarPaginas, pestana]);

  const cargarResumen = useCallback(async () => {
    try { setErrorGeneral(''); setResumen(await obtenerResumenAdminApi(token)); }
    catch (error) { setErrorGeneral(error instanceof Error ? error.message : 'No se pudo cargar el resumen.'); }
  }, [token]);
  useEffect(() => { if (pestana === 'resumen') void cargarResumen(); }, [cargarResumen, pestana]);

  const cargarAuditoria = useCallback(async () => {
    try { setErrorGeneral(''); setAuditoria((await listarAuditoriaAdminApi(token, 100)).registros); }
    catch (error) { setErrorGeneral(error instanceof Error ? error.message : 'No se pudo cargar la auditoría.'); }
  }, [token]);
  useEffect(() => { if (pestana === 'auditoria' || pestana === 'resumen') void cargarAuditoria(); }, [cargarAuditoria, pestana]);

  async function cambiarVerificacion(pagina: PaginaSocial, verificada: boolean) {
    try {
      const resultado = await verificarPaginaApi(pagina._id, verificada, token, pagina.solicitudVerificacion);
      setPaginas((actuales) => actuales.map((actual) => actual._id === pagina._id ? resultado.pagina : actual));
      if (pagina.solicitudVerificacion) setResumen((actual) => actual ? { ...actual, paginasSinVerificar: Math.max(0, actual.paginasSinVerificar - 1) } : actual);
    } catch (error) {
      setErrorPaginas(error instanceof Error ? error.message : 'No se pudo cambiar la verificación.');
    }
  }

  return (
    <section className="gestion-universitaria">
      <h1>{SECCIONES_ADMIN[pestana]}</h1>
      {errorGeneral && <div className="mensaje-error-auth" role="alert">{errorGeneral}</div>}
        {pestana === 'resumen' && <>
          <div className="admin-resumen-encabezado"><button type="button" className="boton-secundario" onClick={() => { void cargarResumen(); void cargarAuditoria(); }}>Actualizar resumen</button></div>
          <div className="admin-metricas">
            <article><span>Usuarios activos</span><strong>{resumen?.usuariosActivos ?? '—'}</strong><small>{resumen?.estudiantes ?? '—'} estudiantes · {resumen?.profesores ?? '—'} profesores</small></article>
            <article><span>Equipo administrativo</span><strong>{resumen ? resumen.moderadores + resumen.administradores : '—'}</strong><small>{resumen?.moderadores ?? '—'} moderadores · {resumen?.administradores ?? '—'} administradores</small></article>
            <article><span>Reportes pendientes</span><strong>{resumen?.reportesPendientes ?? '—'}</strong><small>Casos por revisar o resolver</small></article>
            <article><span>Baneos activos</span><strong>{resumen?.baneosActivos ?? '—'}</strong><small>Sesiones suspendidas</small></article>
            <article><span>Páginas por verificar</span><strong>{resumen?.paginasSinVerificar ?? '—'}</strong><small>Solicitudes institucionales pendientes</small></article>
          </div>
          <section className="tarjeta admin-lista"><div className="admin-lista-encabezado"><div><h2>Actividad reciente</h2><p>Operaciones con registro de auditoría.</p></div><button type="button" className="boton-secundario" onClick={() => setPestana('auditoria')}>Ver auditoría</button></div>
            {auditoria.slice(0, 5).length === 0 ? <p>No hay actividad administrativa registrada.</p> : auditoria.slice(0, 5).map((registro) => <article className="admin-usuario" key={registro._id}><div className="admin-usuario-info"><strong>{nombreAccionAuditoria(registro.action)}</strong><span>{registro.actorName ?? registro.actorId} · {nombreObjetivoAuditoria(registro.targetType)} · {registro.targetId}</span><small>{new Date(registro.createdAt).toLocaleString('es-CO')}</small></div></article>)}
          </section>
          <div className="admin-accesos-rapidos">{(Object.keys(SECCIONES_ADMIN) as SeccionAdmin[]).filter((id) => id !== 'resumen').map((id) => <button type="button" key={id} onClick={() => setPestana(id)}>{SECCIONES_ADMIN[id]} <span>→</span></button>)}</div>
        </>}
        {pestana === 'usuarios' && <PanelAdministracion token={token} rolActual={usuario.role} usuarioActualId={usuario._id} seccion="usuarios" />}
        {pestana === 'catalogos' && <CatalogosAdministracion token={token} />}
        {pestana === 'moderacion' && <PanelAdministracion token={token} rolActual={usuario.role} usuarioActualId={usuario._id} seccion="moderacion" />}
        {pestana === 'auditoria' && <section className="tarjeta admin-lista"><div className="admin-lista-encabezado"><div><h2>Registro de auditoría</h2><p>Últimos {auditoria.length} cambios administrativos.</p></div><button type="button" className="boton-secundario" onClick={() => void cargarAuditoria()}>Actualizar</button></div>{auditoria.length === 0 ? <p>No hay eventos de auditoría registrados.</p> : auditoria.map((registro) => <article className="admin-usuario" key={registro._id}><div className="admin-usuario-info"><strong>{nombreAccionAuditoria(registro.action)}</strong><span>{nombreRolAdministracion(registro.actorRole)} · {registro.actorName ?? registro.actorId} · {nombreObjetivoAuditoria(registro.targetType)} {registro.targetId}</span><small>{new Date(registro.createdAt).toLocaleString('es-CO')} {registro.details ? `· ${describirDetallesAuditoria(registro.details)}` : ''}</small></div></article>)}</section>}
        {pestana === 'paginas' && <>
        <CrearPaginaInstitucional permiteVerificar token={token} alCrear={cargarPaginas} />
        <section className="tarjeta admin-lista" id="paginas">
          <div className="admin-lista-encabezado">
            <div><h2>Verificación de páginas</h2><p>Revisa las solicitudes o cambia la insignia desde el menú de cada página.</p></div>
            <button type="button" className="boton-secundario" onClick={() => void cargarPaginas()}>Actualizar páginas</button>
          </div>
          {errorPaginas && <div className="mensaje-error-auth" role="alert">{errorPaginas}</div>}
          {paginaDetalle && <article className="admin-detalle-pagina"><div><strong>{paginaDetalle.nombre}</strong><p>{paginaDetalle.descripcion || 'Sin descripción.'}</p><small>Dueño: {paginaDetalle.propietarioId} · {paginaDetalle.seguidores} seguidores · {paginaDetalle.categoria}</small></div><button type="button" className="boton-secundario" onClick={() => setPaginaDetalle(null)}>Cerrar detalles</button></article>}
          {paginas.length === 0 ? <p>No hay páginas registradas.</p> : paginas.map((pagina) => (
            <article className="admin-usuario" key={pagina._id}>
              <div className="admin-usuario-info">
                <strong>{pagina.nombre}</strong>
                <span>{pagina.categoria} · {pagina.seguidores} seguidores</span>
                <small>{pagina.verificationStatus === 'VERIFIED' ? 'Verificada' : pagina.verificationStatus === 'REJECTED' ? 'Verificación rechazada' : pagina.solicitudVerificacion ? 'Solicitud pendiente' : 'Sin verificar'}</small>
              </div>
              <div className="admin-acciones admin-menu-ancla">
                <button type="button" className="boton-icono" aria-label={`Opciones de ${pagina.nombre}`} aria-expanded={menuPaginaAbierto === pagina._id} onClick={() => setMenuPaginaAbierto((abierto) => abierto === pagina._id ? null : pagina._id)}>⋯</button>
                {menuPaginaAbierto === pagina._id && <div className="admin-menu-contextual" role="menu">{pagina.solicitudVerificacion ? <><button type="button" role="menuitem" onClick={() => { void cambiarVerificacion(pagina, true); setMenuPaginaAbierto(null); }}>Verificar página</button><button type="button" role="menuitem" className="peligro" onClick={() => { void cambiarVerificacion(pagina, false); setMenuPaginaAbierto(null); }}>Rechazar solicitud</button></> : <button type="button" role="menuitem" onClick={() => { void cambiarVerificacion(pagina, !pagina.isVerified); setMenuPaginaAbierto(null); }}>{pagina.isVerified ? 'Retirar verificación' : 'Aprobar página'}</button>}<button type="button" role="menuitem" onClick={() => { setPaginaDetalle(pagina); setMenuPaginaAbierto(null); }}>Ver detalles</button></div>}
              </div>
            </article>
          ))}
        </section>
        </>}
    </section>
  );
}
