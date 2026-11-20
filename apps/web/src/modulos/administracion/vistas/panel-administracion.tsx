'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UsuarioAdministracion,
  banearUsuarioAdminApi,
  cambiarRolAdminApi,
  cambiarPerfilUsuarioAdminApi,
  crearUsuarioAdminApi,
  desbanearUsuarioAdminApi,
  cambiarEstadoUsuarioAdminApi,
  listarUsuariosAdminApi,
  restablecerContrasenaAdminApi,
} from '../servicios/servicio-api';
import { listarReportesModeracionApi, resolverReporteModeracionApi, type ReporteModeracion } from '@/modulos/moderacion/servicios/servicio-api';
import type { TipoCuenta, RolUsuario, Sede } from '@/servicios/api-cliente';
import { listarCatalogosAdminApi, type ElementoCatalogoAdministrativo } from '../servicios/servicio-api';

const MOTIVOS = [
  ['SPAM', 'Spam'],
  ['ACOSO', 'Acoso'],
  ['CONTENIDO_INAPROPIADO', 'Contenido inapropiado'],
  ['FRAUDE', 'Fraude o estafa'],
  ['INCUMPLIMIENTO', 'Incumplimiento de normas'],
  ['OTRO', 'Otro motivo'],
];

const NOMBRES_TIPO_REPORTE: Record<string, string> = {
  POST: 'Publicación', COMMENT: 'Comentario', USER: 'Cuenta', PAGE: 'Página', MESSAGE: 'Mensaje',
};
const NOMBRES_MOTIVO_REPORTE: Record<string, string> = {
  SPAM: 'Correo o contenido no solicitado', ACOSO: 'Acoso', CONTENIDO_INAPROPIADO: 'Contenido inapropiado',
  FRAUDE: 'Fraude', SUPLANTACION: 'Suplantación', OTRO: 'Otro motivo',
};
const NOMBRES_ESTADO_REPORTE: Record<string, string> = {
  PENDING: 'Pendiente', REVIEWING: 'En revisión', RESOLVED: 'Resuelto', DISMISSED: 'Descartado',
};

function nombreRol(rol: RolUsuario) {
  return rol === 'ADMIN' ? 'Administrador' : rol === 'MODERATOR' ? 'Moderador' : 'Usuario';
}

function nombreTipo(tipo: TipoCuenta) {
  return tipo === 'PAGE' ? 'Página institucional' : tipo === 'TEACHER' ? 'Profesor' : 'Estudiante';
}

export function PanelAdministracion({
  token,
  rolActual,
  usuarioActualId,
  seccion = 'completa',
}: {
  token: string;
  rolActual: RolUsuario;
  usuarioActualId: string;
  seccion?: 'usuarios' | 'moderacion' | 'completa';
}) {
  const esAdmin = rolActual === 'ADMIN';
  const esAdminFundador = usuarioActualId === 'local_admin';
  const [usuarios, setUsuarios] = useState<UsuarioAdministracion[]>([]);
  const [catalogos, setCatalogos] = useState<ElementoCatalogoAdministrativo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [claveTemporal, setClaveTemporal] = useState('');
  const [reportes, setReportes] = useState<ReporteModeracion[]>([]);
  const [motivoBaneo, setMotivoBaneo] = useState('INCUMPLIMIENTO');
  const [busquedaUsuarios, setBusquedaUsuarios] = useState('');
  const [filtroRol, setFiltroRol] = useState<'TODOS' | RolUsuario>('TODOS');
  const [filtroPerfil, setFiltroPerfil] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ACTIVE' | 'BANEADO' | 'DELETED'>('TODOS');
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState<string | null>(null);
  const [menuReporteAbierto, setMenuReporteAbierto] = useState<string | null>(null);
  const [mostrarFormularioCrear, setMostrarFormularioCrear] = useState(false);
  const [busquedaReportes, setBusquedaReportes] = useState('');
  const [filtroTipoReporte, setFiltroTipoReporte] = useState('TODOS');
  const [nuevo, setNuevo] = useState({
    username: '',
    email: '',
    displayName: '',
    campus: 'URABA' as Sede,
    programId: '',
    tipoPerfilId: 'STUDENT',
    accountType: 'STUDENT' as TipoCuenta,
    role: 'USER' as RolUsuario,
  });

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resultado = await listarUsuariosAdminApi(token);
      setUsuarios(resultado.usuarios);
      setCatalogos((await listarCatalogosAdminApi(token)).catalogos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las cuentas.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    if (seccion === 'completa' || seccion === 'usuarios') void cargarUsuarios();
  }, [cargarUsuarios, seccion]);

  const cargarReportes = useCallback(async () => {
    try { setReportes((await listarReportesModeracionApi(token)).reportes); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.'); }
  }, [token]);
  useEffect(() => { if (seccion === 'completa' || seccion === 'moderacion') void cargarReportes(); }, [cargarReportes, seccion]);

  async function resolverReporte(reporte: ReporteModeracion, status: 'REVIEWING' | 'RESOLVED' | 'DISMISSED', accion: 'OCULTAR' | 'ELIMINAR' | 'BANEAR' | 'NINGUNA') {
    try {
      await resolverReporteModeracionApi(reporte._id, status, accion, token);
      setMensaje(status === 'REVIEWING' ? 'Reporte asignado para revisión.' : 'Reporte resuelto.');
      await cargarReportes();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar el reporte.'); }
  }

  async function crearCuenta(evento: React.FormEvent) {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setClaveTemporal('');
    try {
      const resultado = await crearUsuarioAdminApi(nuevo, token);
      setUsuarios((lista) => [resultado.usuario, ...lista]);
      setClaveTemporal(resultado.claveTemporal);
      setMensaje(resultado.mensaje);
      setNuevo({ ...nuevo, username: '', email: '', displayName: '', programId: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
    }
  }

  async function alternarBaneo(usuario: UsuarioAdministracion) {
    setError('');
    try {
      if (usuario.banUntil && new Date(usuario.banUntil) > new Date()) {
        await desbanearUsuarioAdminApi(usuario._id, token);
        setMensaje(`Se retiró el baneo de @${usuario.username}.`);
      } else {
        const resultado = await banearUsuarioAdminApi(usuario._id, motivoBaneo, '', token, 30);
        setMensaje(`@${usuario.username} quedó baneado hasta ${new Date(resultado.banUntil).toLocaleDateString('es-CO')}.`);
      }
      await cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el baneo.');
    }
  }

  async function restablecerClave(usuario: UsuarioAdministracion) {
    setError('');
    setClaveTemporal('');
    try {
      const resultado = await restablecerContrasenaAdminApi(usuario._id, token);
      setClaveTemporal(`${usuario.username}:${resultado.claveTemporal}`);
      setMensaje(`Contraseña temporal restablecida para @${usuario.username}.`);
      await cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    }
  }

  async function cambiarRol(usuario: UsuarioAdministracion, role: RolUsuario) {
    setError('');
    try {
      const resultado = await cambiarRolAdminApi(usuario._id, role, token);
      setUsuarios((lista) => lista.map((actual) => actual._id === usuario._id ? resultado.usuario : actual));
      setMensaje(`El rol de @${usuario.username} ahora es ${nombreRol(role)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el rol.');
    }
  }

  async function cambiarPerfil(usuario: UsuarioAdministracion, perfilId: string) {
    setError('');
    try {
      const resultado = await cambiarPerfilUsuarioAdminApi(usuario._id, perfilId, token);
      setUsuarios((lista) => lista.map((actual) => actual._id === usuario._id ? { ...actual, accountType: resultado.accountType, accountLabel: resultado.perfil, accountProfileId: perfilId } : actual));
      setMensaje(`El perfil de @${usuario.username} ahora es ${resultado.perfil}.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cambiar el perfil.'); }
  }

  async function cambiarEstadoCuenta(usuario: UsuarioAdministracion, activo: boolean) {
    const accion = activo ? 'habilitar' : 'inhabilitar';
    if (!window.confirm(`¿${activo ? 'Habilitar' : 'Inhabilitar'} la cuenta @${usuario.username}? Sus datos se conservarán.`)) return;
    setError('');
    try {
      await cambiarEstadoUsuarioAdminApi(usuario._id, activo, token);
      setUsuarios((lista) => lista.map((actual) => actual._id === usuario._id ? { ...actual, status: activo ? 'ACTIVE' : 'DELETED' } : actual));
      setMensaje(`Se ${accion === 'habilitar' ? 'habilitó' : 'inhabilitó'} la cuenta @${usuario.username}. Sus datos se conservaron.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `No se pudo ${accion} la cuenta.`);
    }
  }

  const usuariosFiltrados = useMemo(() => usuarios.filter((usuario) => {
    const consulta = busquedaUsuarios.trim().toLocaleLowerCase('es');
    const coincideBusqueda = !consulta || [usuario.displayName, usuario.username, usuario.email].some((dato) => dato.toLocaleLowerCase('es').includes(consulta));
    const coincideRol = filtroRol === 'TODOS' || usuario.role === filtroRol;
    const perfilActual = usuario.accountLabel ?? nombreTipo(usuario.accountType ?? 'STUDENT');
    const coincidePerfil = filtroPerfil === 'TODOS' || perfilActual === filtroPerfil;
    const baneado = Boolean(usuario.banUntil && new Date(usuario.banUntil) > new Date());
    const coincideEstado = filtroEstado === 'TODOS' || filtroEstado === 'ACTIVE' && usuario.status === 'ACTIVE' && !baneado || filtroEstado === 'BANEADO' && baneado || filtroEstado === 'DELETED' && usuario.status === 'DELETED';
    return coincideBusqueda && coincideRol && coincidePerfil && coincideEstado;
  }), [usuarios, busquedaUsuarios, filtroRol, filtroPerfil, filtroEstado]);

  const sedesActivas = catalogos.filter((item) => item.tipo === 'sede' && item.activo);
  const perfilesActivos = catalogos.filter((item) => item.tipo === 'perfil' && item.activo);
  const perfilSeleccionado = perfilesActivos.find((perfil) => perfil.id === nuevo.tipoPerfilId);
  const programasActivos = catalogos.filter((item) => item.tipo === 'programa' && item.activo && item.sedes?.includes(nuevo.campus));

  const reportesFiltrados = useMemo(() => reportes.filter((reporte) => {
    const consulta = busquedaReportes.trim().toLocaleLowerCase('es');
    const coincideBusqueda = !consulta || [reporte.reporterName, reporte.targetId, reporte.reason, reporte.details ?? ''].some((dato) => dato.toLocaleLowerCase('es').includes(consulta));
    return coincideBusqueda && (filtroTipoReporte === 'TODOS' || reporte.targetType === filtroTipoReporte);
  }), [reportes, busquedaReportes, filtroTipoReporte]);

  return (
    <div className="admin-panel">
      {seccion === 'completa' && <header className="encabezado-vista">
        <div>
          <h1>{esAdmin ? 'Administración' : 'Moderación'}</h1>
          <p>{esAdmin ? 'Gestiona cuentas, permisos, contraseñas y baneos.' : 'Revisa cuentas y aplica baneos temporales.'}</p>
        </div>
        <button type="button" className="boton-secundario" onClick={() => void cargarUsuarios()}>
          Actualizar lista
        </button>
      </header>}

      {error && <div className="mensaje-error-auth">{error}</div>}
      {mensaje && <div className="admin-mensaje">{mensaje}</div>}
      {claveTemporal && (
        <div className="admin-clave-temporal">
          <strong>Credencial temporal (se muestra una sola vez)</strong>
          <code>{claveTemporal}</code>
          <span>La persona debe cambiar esta contraseña al iniciar sesión.</span>
        </div>
      )}

      {(seccion === 'completa' || seccion === 'usuarios') && esAdmin && (
        <div className="admin-crear-usuario-barra"><div><strong>Directorio de usuarios</strong><span>La información se consulta aquí; las medidas se encuentran en ⋯.</span></div><button type="button" className="boton-primario" onClick={() => setMostrarFormularioCrear((visible) => !visible)}>{mostrarFormularioCrear ? 'Cerrar formulario' : 'Crear usuario'}</button></div>
      )}

      {(seccion === 'completa' || seccion === 'usuarios') && esAdmin && mostrarFormularioCrear && (
        <form className="tarjeta admin-formulario" onSubmit={crearCuenta}>
          <h2>Crear cuenta</h2>
          <div className="admin-campos">
            <label>Nombre visible<input required minLength={2} maxLength={80} value={nuevo.displayName} onChange={(e) => setNuevo({ ...nuevo, displayName: e.target.value })} /></label>
            <label>Usuario<input required minLength={3} maxLength={30} pattern="[a-z0-9_.]+" value={nuevo.username} onChange={(e) => setNuevo({ ...nuevo, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })} /></label>
            <label>Correo<input required type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></label>
            <label>Perfil<select required value={nuevo.tipoPerfilId} onChange={(e) => { const perfil = perfilesActivos.find((item) => item.id === e.target.value); setNuevo({ ...nuevo, tipoPerfilId: e.target.value, accountType: perfil?.tipoBase ?? 'STUDENT', role: perfil?.tipoBase === 'PAGE' ? 'USER' : nuevo.role, programId: '' }); }}>{perfilesActivos.map((perfil) => <option key={perfil.id} value={perfil.id}>{perfil.nombre}</option>)}</select></label>
            <label>Permiso de acceso<select disabled={perfilSeleccionado?.tipoBase === 'PAGE'} value={nuevo.role} onChange={(e) => setNuevo({ ...nuevo, role: e.target.value as RolUsuario })}><option value="USER">Usuario</option><option value="MODERATOR">Moderador</option>{esAdminFundador && <option value="ADMIN">Administrador</option>}</select></label>
            <label>Sede<select required value={nuevo.campus} onChange={(e) => setNuevo({ ...nuevo, campus: e.target.value as Sede, programId: '' })}>{sedesActivas.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}</select></label>
            {perfilSeleccionado?.tipoBase !== 'PAGE' && <label>Carrera o programa<select required value={nuevo.programId} onChange={(e) => setNuevo({ ...nuevo, programId: e.target.value })}><option value="">Selecciona una carrera</option>{programasActivos.map((programa) => <option key={programa.id} value={programa.id}>{programa.nombre}</option>)}</select></label>}
          </div>
          <p>Los permisos de acceso son administrados por el sistema. Los perfiles y las carreras se pueden configurar en «Carreras y listas».</p>
          <p>La contraseña inicial será igual al usuario y se exigirá cambiarla al entrar.</p>
          <button type="submit" className="boton-primario" disabled={!perfilSeleccionado || !sedesActivas.length || (perfilSeleccionado.tipoBase !== 'PAGE' && !programasActivos.length)}>Crear cuenta</button>
        </form>
      )}

      {(seccion === 'completa' || seccion === 'usuarios') && <section className="tarjeta admin-lista" id="cuentas">
        <div className="admin-lista-encabezado">
          <h2>Usuarios ({usuariosFiltrados.length} de {usuarios.length})</h2>
          <div className="admin-filtros-usuarios"><input value={busquedaUsuarios} onChange={(e) => setBusquedaUsuarios(e.target.value)} placeholder="Buscar por nombre, usuario o correo" aria-label="Buscar usuarios"/><select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value as typeof filtroRol)} aria-label="Filtrar por permiso de acceso"><option value="TODOS">Todos los permisos</option><option value="USER">Usuario</option><option value="MODERATOR">Moderador</option><option value="ADMIN">Administrador</option></select><select value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)} aria-label="Filtrar por perfil de cuenta"><option value="TODOS">Todos los perfiles</option>{catalogos.filter((item) => item.tipo === 'perfil').map((perfil) => <option key={perfil.id} value={perfil.nombre}>{perfil.nombre}{perfil.activo ? '' : ' (inhabilitado)'}</option>)}</select><select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} aria-label="Filtrar por estado"><option value="TODOS">Todos los estados</option><option value="ACTIVE">Activos</option><option value="BANEADO">Baneados</option><option value="DELETED">Inhabilitados</option></select></div>
        </div>
        {cargando ? <p>Cargando cuentas…</p> : usuariosFiltrados.map((usuario) => {
          const baneado = Boolean(usuario.banUntil && new Date(usuario.banUntil) > new Date());
          const perfilActualId = usuario.accountProfileId ?? catalogos.find((perfil) => perfil.tipo === 'perfil' && perfil.nombre === usuario.accountLabel)?.id ?? usuario.accountType;
          const perfilesDisponibles = catalogos.filter((perfil) => perfil.tipo === 'perfil' && perfil.tipoBase !== 'PAGE' && (perfil.activo || perfil.id === perfilActualId));
          return (
            <article className="admin-usuario" key={usuario._id}>
              <div className="admin-usuario-info">
                <strong>{usuario.displayName} {usuario._id === usuarioActualId ? '(tú)' : ''}</strong>
                <span>@{usuario.username} · {usuario.accountLabel ?? nombreTipo(usuario.accountType ?? 'STUDENT')} · {nombreRol(usuario.role)}</span>
                <small>{usuario.email} · {usuario.status === 'DELETED' ? 'Inhabilitado (datos conservados)' : baneado ? `Baneado hasta ${new Date(usuario.banUntil!).toLocaleDateString('es-CO')} (${usuario.banReason ?? 'OTRO'})` : 'Activo'}</small>
              </div>
              <div className="admin-acciones">
                <button type="button" className="boton-icono" aria-label={`Opciones de ${usuario.username}`} aria-expanded={menuUsuarioAbierto === usuario._id} onClick={() => setMenuUsuarioAbierto((abierto) => abierto === usuario._id ? null : usuario._id)}>⋯</button>
                {menuUsuarioAbierto === usuario._id && <div className="admin-menu-contextual" role="menu">
                  {(usuario.role === 'USER' || (esAdmin && (usuario.role !== 'ADMIN' || esAdminFundador))) && usuario._id !== usuarioActualId && usuario.status === 'ACTIVE' && <><label>Motivo<select value={motivoBaneo} onChange={(e) => setMotivoBaneo(e.target.value)}>{MOTIVOS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label><button type="button" role="menuitem" onClick={() => { void alternarBaneo(usuario); setMenuUsuarioAbierto(null); }}>{baneado ? 'Quitar baneo' : 'Banear 30 días'}</button></>}
                  {esAdmin && usuario._id !== usuarioActualId && usuario.status === 'DELETED' && <button type="button" role="menuitem" onClick={() => { void cambiarEstadoCuenta(usuario, true); setMenuUsuarioAbierto(null); }}>Habilitar cuenta</button>}
                  {esAdmin && usuario._id !== usuarioActualId && usuario.status !== 'DELETED' && <>
                    {usuario.accountType !== 'PAGE' && <label>Cambiar perfil<select aria-label={`Perfil de ${usuario.username}`} value={perfilActualId} onChange={(e) => void cambiarPerfil(usuario, e.target.value)}>{perfilesDisponibles.map((perfil) => <option key={perfil.id} value={perfil.id}>{perfil.nombre}{perfil.activo ? '' : ' (inhabilitado)'}</option>)}</select></label>}
                    <label>Cambiar rol<select aria-label={`Rol de ${usuario.username}`} value={usuario.role} disabled={usuario.accountType === 'PAGE' || (usuario.role === 'ADMIN' && !esAdminFundador)} onChange={(e) => void cambiarRol(usuario, e.target.value as RolUsuario)}><option value="USER">Usuario</option><option value="MODERATOR">Moderador</option>{esAdminFundador && <option value="ADMIN">Administrador</option>}</select></label>
                    <button type="button" role="menuitem" onClick={() => { void restablecerClave(usuario); setMenuUsuarioAbierto(null); }}>Restablecer contraseña</button>
                    {usuario.role !== 'ADMIN' || esAdminFundador ? <button type="button" role="menuitem" className="peligro" onClick={() => { void cambiarEstadoCuenta(usuario, false); setMenuUsuarioAbierto(null); }}>Inhabilitar cuenta</button> : null}
                  </>}
                  {usuario._id === usuarioActualId && <span className="admin-menu-nota">No puedes modificar tu propia cuenta desde aquí.</span>}
                </div>}
              </div>
            </article>
          );
        })}
        {!cargando && usuarios.length === 0 && <p>No hay cuentas registradas todavía.</p>}
      </section>}

      {(seccion === 'completa' || seccion === 'moderacion') && <section className="tarjeta admin-lista" id="reportes">
        <div className="admin-lista-encabezado admin-encabezado-reportes"><h2>Reportes por revisar ({reportesFiltrados.length} de {reportes.length})</h2><div className="admin-filtros-usuarios"><input value={busquedaReportes} onChange={(e) => setBusquedaReportes(e.target.value)} placeholder="Buscar motivo, autor o identificador" aria-label="Buscar reportes"/><select value={filtroTipoReporte} onChange={(e) => setFiltroTipoReporte(e.target.value)} aria-label="Filtrar tipo de reporte"><option value="TODOS">Todos los tipos</option>{['POST','COMMENT','USER','PAGE','MESSAGE'].map((tipo) => <option key={tipo} value={tipo}>{NOMBRES_TIPO_REPORTE[tipo]}</option>)}</select><button type="button" className="boton-secundario" onClick={() => void cargarReportes()}>Actualizar</button></div></div>
        {reportesFiltrados.length === 0 ? <p>No hay reportes que coincidan con esos filtros.</p> : reportesFiltrados.map((reporte) => <article className="admin-usuario" key={reporte._id}>
          <div className="admin-usuario-info"><strong>{NOMBRES_TIPO_REPORTE[reporte.targetType] ?? 'Contenido'} · {NOMBRES_MOTIVO_REPORTE[reporte.reason] ?? 'Otro motivo'}</strong><span>Reportó {reporte.reporterName} · {NOMBRES_ESTADO_REPORTE[reporte.status] ?? 'Pendiente'}</span><small>{reporte.details || `Elemento ${reporte.targetId}`}</small></div>
          <div className="admin-acciones"><button type="button" className="boton-icono" aria-label={`Opciones del reporte ${reporte._id}`} aria-expanded={menuReporteAbierto === reporte._id} onClick={() => setMenuReporteAbierto((abierto) => abierto === reporte._id ? null : reporte._id)}>⋯</button>{menuReporteAbierto === reporte._id && <div className="admin-menu-contextual" role="menu"><button type="button" role="menuitem" onClick={() => { void resolverReporte(reporte, 'REVIEWING', 'NINGUNA'); setMenuReporteAbierto(null); }}>Asignarme el caso</button>{['POST','COMMENT'].includes(reporte.targetType) && <button type="button" role="menuitem" className="peligro" onClick={() => { void resolverReporte(reporte, 'RESOLVED', 'OCULTAR'); setMenuReporteAbierto(null); }}>Ocultar contenido y resolver</button>}{reporte.targetType === 'USER' && <button type="button" role="menuitem" className="peligro" onClick={() => { void resolverReporte(reporte, 'RESOLVED', 'BANEAR'); setMenuReporteAbierto(null); }}>Banear 30 días y resolver</button>}<button type="button" role="menuitem" onClick={() => { void resolverReporte(reporte, 'DISMISSED', 'NINGUNA'); setMenuReporteAbierto(null); }}>Descartar reporte</button></div>}</div>
        </article>)}
      </section>}
    </div>
  );
}
