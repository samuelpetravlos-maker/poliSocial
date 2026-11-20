'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/modulos/autenticacion/controladores/contexto';
import {
  NOMBRE_CANAL,
  nombreDeSede,
  type AutorSocial,
  type Canal,
  type ConversacionSocial,
  type PublicacionSocial,
  type Sede,
} from '@/datos/modelos-sociales';
import { Avatar, InsigniaVerificado } from '@/componentes_compartidos/comunes/avatar';
import { Icono, type NombreIcono } from '@/componentes_compartidos/comunes/iconos';
import { ModalAutenticacion } from '@/modulos/autenticacion/vistas/modal-autenticacion';
import { BusquedaGlobal } from './busqueda-global';
import { PanelComunidades } from '@/modulos/comunidades/vistas/panel-comunidades';
import { BandejaMensajes } from '@/modulos/chats/vistas/bandeja-mensajes';
import { ModalCrearChatGrupo, type EstudianteDisponible } from '@/modulos/chats/vistas/modal-crear-chat-grupo';
import { TarjetaPublicacion } from '@/modulos/publicaciones/vistas/tarjeta-publicacion';
import { PanelModeracion } from '@/modulos/moderacion/vistas/panel-moderacion';
import { CambioContrasenaObligatorio } from '@/modulos/autenticacion/vistas/cambio-contrasena-obligatorio';
import { tienePermisoInterfaz } from '@/modulos/autenticacion/servicios/permisos-interfaz';
import { BandejaNotificaciones } from '@/modulos/notificaciones/vistas/bandeja-notificaciones';
import { EncabezadoVista } from './encabezado-vista';
import { CompositorPublicacion, type DatosNuevaPublicacion } from './compositor-publicacion';
import { BotonNavegacion, type VistaSocial } from './boton-navegacion';
import { adaptarChatApi, adaptarPublicacionApi } from '../servicios/adaptadores-api';
import { SelectorIdentidad } from '@/modulos/paginas/vistas/selector-identidad';
import { PerfilSocial } from '@/modulos/usuarios/vistas/perfil-social';
import { listarPaginasApi, seguirPaginaApi, verificarPaginaApi, type PaginaSocial } from '@/modulos/paginas/servicios/servicio-api';
import { crearChatGrupoApi, listarChatsApi } from '@/modulos/chats/servicios/servicio-api';
import { votarEncuesta, editarPublicacion, retirarPublicacion, aceptarRespuesta, guardarReferencia, cargarGuardadas, obtenerPublicacion, crearComentarioApi, crearPublicacionApi, guardarReaccionApi, listarComentariosApi, listarPublicacionesApi } from '@/modulos/publicaciones/servicios/servicio-api';
import { crearReporteApi, ejecutarAccionModeracionApi } from '@/modulos/moderacion/servicios/servicio-api';

import { listarSeguidosApi, listarUsuariosApi, seguirUsuarioApi, type Usuario } from '@/modulos/usuarios/servicios/servicio-api';
import { subirArchivoApi } from '@/modulos/archivos/servicios/servicio-api';

import { HerramientasAdministracion, SECCIONES_ADMIN, type SeccionAdmin } from '@/modulos/administracion/vistas/herramientas-administracion';
import { CrearPaginaInstitucional } from '@/modulos/paginas/vistas/crear-pagina-institucional';
import { EstadosUniversitarios } from '@/modulos/estados/vistas/estados-universitarios';
type Vista = VistaSocial;
const iconosGestion: Record<SeccionAdmin, NombreIcono> = {
  resumen: 'inicio', usuarios: 'personas', moderacion: 'escudo', paginas: 'verificado', catalogos: 'graduacion', auditoria: 'ajustes',
};
function vistaGestion(vista: string): vista is SeccionAdmin { return Object.prototype.hasOwnProperty.call(SECCIONES_ADMIN, vista); }

type Filtro = 'global' | 'sede' | 'siguiendo';
type FiltroReaccion = 'TODAS' | 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED';

const NAVEGACION: Array<{ vista: Vista; etiqueta: string; icono: NombreIcono }> = [
  { vista: 'inicio', etiqueta: 'Inicio', icono: 'inicio' },
  { vista: 'foros', etiqueta: 'Foros', icono: 'foros' },
  { vista: 'comunidades', etiqueta: 'Comunidades', icono: 'personas' },
  { vista: 'mensajes', etiqueta: 'Mensajes', icono: 'mensajes' },
  { vista: 'paginas', etiqueta: 'Páginas', icono: 'verificado' },
  { vista: 'perfil', etiqueta: 'Perfil', icono: 'perfil' },
];

const CANALES_FORO: Array<{
  canal: Canal;
  titulo: string;
  descripcion: string;
  icono: NombreIcono;
}> = [
  {
    canal: 'ACADEMICO',
    titulo: 'Académico y Código',
    descripcion: 'Dudas de asignaturas, algoritmos y preparación de parciales.',
    icono: 'codigo',
  },
  {
    canal: 'PROYECTOS',
    titulo: 'Proyectos y Semilleros',
    descripcion: 'Equipos para proyectos integradores, hackathons e investigación.',
    icono: 'personas',
  },
  {
    canal: 'AVISOS',
    titulo: 'Avisos Poli',
    descripcion: 'Fechas académicas, eventos, deportes y bienestar universitario.',
    icono: 'campana',
  },
  {
    canal: 'MERCADO',
    titulo: 'Mercado Poli',
    descripcion: 'Compra, venta e intercambio entre estudiantes del Poli.',
    icono: 'maletin',
  },
];

function nombreRolAcceso(rol: 'USER' | 'MODERATOR' | 'ADMIN') {
  return rol === 'ADMIN' ? 'Administrador' : rol === 'MODERATOR' ? 'Moderador' : 'Usuario';
}

function nombreTipoCuenta(tipo: 'STUDENT' | 'TEACHER' | 'PAGE') {
  return tipo === 'PAGE' ? 'Página institucional' : tipo === 'TEACHER' ? 'Profesor' : 'Estudiante';
}

export default function AplicacionPoliSocialNetwork() {
  const { usuario, cargando } = useAuth();
  const ruta = usePathname();
  const router = useRouter();
  const destino = usuario?.role === 'ADMIN' ? '/admin' : '/inicio';
  const debeRedirigir = !cargando && !!usuario && ruta !== destino;

  useEffect(() => {
    if (debeRedirigir) router.replace(destino + window.location.search + window.location.hash);
  }, [debeRedirigir, destino, router]);

  if (cargando) return <p className="pantalla-cargando" role="status">Cargando sesión…</p>;
  if (debeRedirigir) return <p className="pantalla-cargando" role="status">Abriendo tu espacio…</p>;
  return <ContenidoComunidad key={usuario?._id ?? 'acceso'} />;
}

function ContenidoComunidad() {
  const [vista, setVista] = useState<Vista>('inicio');
  const [filtro, setFiltro] = useState<Filtro>('global');
  const reaccionesEnCurso = useRef(new Set<string>());
  const [guardadas, setGuardadas] = useState<PublicacionSocial[]>([]);
  const [filtroReaccion, setFiltroReaccion] = useState<FiltroReaccion>('TODAS');
  const [tema, setTema] = useState<'claro' | 'oscuro'>('claro');
  const [publicaciones, setPublicaciones] = useState<PublicacionSocial[]>([]);
  const [seguidos, setSeguidos] = useState<string[]>([]);
  const [buscadorAbierto, abrirBuscador] = useState(false);
  const [paginaElegida, elegirPagina] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [canalForo, setCanalForo] = useState<Canal>('ACADEMICO');
  const [chatsBase, setChatsBase] = useState<ConversacionSocial[]>([]);
  const [usuariosChat, setUsuariosChat] = useState<Usuario[]>([]);
  const [chatActivo, setChatActivo] = useState('');

  const { usuario, token, cerrarSesion, backendDisponible } = useAuth();
  const [modalAuthAbierto, setModalAuthAbierto] = useState(false);
  const [modoAuthInicial, setModoAuthInicial] = useState<'login' | 'registro'>('login');
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false);


  useEffect(() => {
    if (usuario?.role !== 'ADMIN') return;
    const navegar = () => {
      const entrada = window.location.hash.slice(1);
      const seccion = entrada === 'reportes' ? 'moderacion' : entrada;
      if (vistaGestion(seccion) || seccion === 'foros') setVista(seccion);
      else setVista('inicio');
    };
    navegar();
    window.addEventListener('hashchange', navegar);
    return () => window.removeEventListener('hashchange', navegar);
  }, [usuario?.role]);

  // Estados de Comunidades y Grupos
  const [modalCrearGrupoChatAbierto, setModalCrearGrupoChatAbierto] = useState(false);

  const autorActivo: AutorSocial = useMemo(() => {
    if (usuario) {
      return {
        id: usuario._id,
        nombre: usuario.displayName,
        usuario: usuario.username,
        sede: usuario.campus,
        etiquetaSede: usuario.campusLabel,
        programa: usuario.program,
        verificado: usuario.isVerifiedPoli,
        color: '#1b5e20',
        avatarUrl: usuario.avatarUrl,
        tipoCuenta: usuario.accountType,
        etiquetaPerfil: usuario.accountLabel,
        rol: usuario.accountType === 'TEACHER' ? 'docente' : 'estudiante',
      };
    }
    return { id: '', nombre: '', usuario: '', sede: '', programa: '', verificado: false, color: '#1b5e20' };
  }, [usuario]);

  useEffect(() => {
    if (token && usuario?.role !== 'ADMIN') listarPaginasApi(token).then((r) => setPaginasSociales(r.paginas)).catch(() => undefined);
  }, [token, usuario?.role]);

  useEffect(() => {
    if (!token || (vista !== 'inicio' && vista !== 'foros' && vista !== 'perfil')) return;
    const channel = vista === 'foros' ? canalForo : undefined;
    let activa = true;
    const destino = vista === 'inicio' && new URLSearchParams(window.location.search).get('publicacion');
    async function cargar() {
      const resultado = await listarPublicacionesApi(token!, vista === 'perfil' ? 'propias' : filtro, channel);
      const lista = resultado.publicaciones.map(adaptarPublicacionApi);
      if (vista === 'perfil') {
        const respondidas = (await listarPublicacionesApi(token!, 'respondidas')).publicaciones.map(adaptarPublicacionApi);
        if (activa) {
          setRespondidasIds(respondidas.map(p => p.id));
          setPublicaciones([...lista, ...respondidas.filter(p => !lista.some(propia => propia.id === p.id))]);
        }
        return;
      }
      if (destino) {
        const detalle = await obtenerPublicacion(destino, token!);
        const enlazada = adaptarPublicacionApi(detalle.publicacion);
        if (activa) setPublicaciones([enlazada, ...lista.filter((p) => p.id !== destino)]);
      } else if (activa) setPublicaciones(lista);
    }
    void cargar().catch((e) => { if (activa) setErrorPublicacion(e instanceof Error ? e.message : 'No se pudo cargar el muro.'); });
    return () => { activa = false; };
  }, [token, vista, filtro, canalForo, usuario?.role]);

  useEffect(() => {
    if (!token || !usuario || !tienePermisoInterfaz(usuario.role, 'interactuar_socialmente')) return;
    let vigente = true;
    async function cargarBandeja() {
      try {
        const bandeja = await listarChatsApi(token!);
        if (vigente) setChatsBase(bandeja.chats.map(chat => adaptarChatApi(chat, usuario!._id)));
      } catch (e) { if (vigente) setErrorPublicacion(e instanceof Error ? e.message : 'No se pudo cargar la bandeja.'); }
    }
    void listarUsuariosApi(token).then(r => { if (vigente) setUsuariosChat(r.usuarios); }).catch(() => undefined);
    void cargarBandeja();
    const intervalo = window.setInterval(cargarBandeja, 10000);
    return () => { vigente = false; window.clearInterval(intervalo); };
  }, [token, usuario?._id, usuario?.role]);

  useEffect(() => {
    if (!token || !usuario || !tienePermisoInterfaz(usuario.role, 'interactuar_socialmente')) return;
    void listarSeguidosApi(usuario._id, token).then((r) => setSeguidos(r.usuarios.map((u) => u._id))).catch(() => undefined);
  }, [token, usuario?._id, usuario?.role]);

  useEffect(() => {
    let activa = true;
    setGuardadas([]);
    if (token && usuario?.role === 'USER') {
      void cargarGuardadas(token).then((r) => { if (activa) setGuardadas(r.publicaciones.map(adaptarPublicacionApi)); })
        .catch((e) => { if (activa) setErrorPublicacion(e instanceof Error ? e.message : 'No se pudieron cargar los guardados.'); });
    }
    return () => { activa = false; };
  }, [token, usuario?._id, usuario?.role]);

  const sugerencias = usuariosChat.filter(u => u._id !== autorActivo.id).map(u => ({
    id: u._id, nombre: u.displayName, usuario: u.username, sede: u.campus,
    programa: u.program, avatarUrl:u.avatarUrl, verificado: u.isVerifiedPoli, color: '#1b5e20',
  }));
  const estudiantesParaGrupo: EstudianteDisponible[] = sugerencias;
  const tendencias = useMemo(() => {
    const cantidades = new Map<string,number>();
    publicaciones.forEach(p => p.etiquetas.forEach(tag => cantidades.set(tag, (cantidades.get(tag) ?? 0) + 1)));
    return [...cantidades].sort((a,b) => b[1] - a[1]).slice(0,5)
      .map(([tag, total]) => ({ etiqueta: '#' + tag, publicaciones: total === 1 ? '1 publicación' : total + ' publicaciones' }));
  }, [publicaciones]);

  const [respondidasIds, setRespondidasIds] = useState<string[]>([]);
  const [paginasSociales, setPaginasSociales] = useState<PaginaSocial[]>([]);
  const [errorPublicacion, setErrorPublicacion] = useState('');
  const consulta = busqueda.trim().toLowerCase();

  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((publicacion) => {
      if (filtroReaccion !== 'TODAS') {
        const conteo = filtroReaccion === 'DISLIKE' ? publicacion.dislikes ?? 0 : publicacion.reaccionesPorTipo?.[filtroReaccion] ?? 0;
        if (conteo < 1) return false;
      }
      if (consulta) {
        const contenido = [
          publicacion.titulo ?? '',
          publicacion.contenido,
          publicacion.autor.nombre,
          publicacion.autor.programa,
          ...publicacion.etiquetas,
        ]
          .join(' ')
          .toLowerCase();
        return contenido.includes(consulta);
      }
      return true;
    });
  }, [publicaciones, filtroReaccion, consulta]);

  const publicacionesForo = useMemo(() => {
    return publicaciones.filter((publicacion) => {
      if (publicacion.canal !== canalForo) return false;
      if (!consulta) return true;
      return [publicacion.titulo ?? '', publicacion.contenido, ...publicacion.etiquetas]
        .join(' ')
        .toLowerCase()
        .includes(consulta);
    });
  }, [publicaciones, canalForo, consulta]);

  const chats = chatsBase;

  async function alternarLike(id: string, tipo: NonNullable<PublicacionSocial['reaccionTipo']> = 'LIKE') {
    if (!token || !tienePermisoInterfaz(usuario?.role, 'interactuar_socialmente') || reaccionesEnCurso.current.has(id)) return;
    const previa = publicaciones.find(p => p.id === id) ?? guardadas.find(p => p.id === id);
    const nuevoTipo = previa?.reaccionTipo === tipo ? null : tipo;
    reaccionesEnCurso.current.add(id);
    try {
      const resumen = await guardarReaccionApi(id, nuevoTipo, token);
      actualizarPublicacion(id, { reaccionTipo: nuevoTipo, reaccionado: !!nuevoTipo && nuevoTipo !== 'DISLIKE',
        likes: resumen.likes, dislikes: resumen.dislikes, reaccionesPorTipo: resumen.porTipo });
    } catch (e) { setErrorPublicacion(e instanceof Error ? e.message : 'No se pudo guardar la reacción.'); }
    finally { reaccionesEnCurso.current.delete(id); }
  }

  function alternarSeguir(id: string) {
    if (!token || !tienePermisoInterfaz(usuario?.role, 'interactuar_socialmente')) return;
    void seguirUsuarioApi(id, !seguidos.includes(id), token)
      .then(r => setSeguidos(actuales => r.siguiendo ? [...new Set([...actuales, id])] : actuales.filter(uid => uid !== id)))
      .catch(e => setErrorPublicacion(e instanceof Error ? e.message : 'No se pudo actualizar el seguimiento.'));
  }

  function alternarSeguirPublicacion(publicacion: PublicacionSocial) {
    if (!tienePermisoInterfaz(usuario?.role, 'interactuar_socialmente')) return;
    if (publicacion.paginaId) {
      const pagina = paginasSociales.find((p) => p._id === publicacion.paginaId);
      if (pagina) {
        void seguirPaginaApi(pagina._id, !pagina.siguiendo, token ?? '').then((r) => setPaginasSociales((actuales) => actuales.map((p) => p._id === pagina._id ? { ...p, siguiendo: r.siguiendo, seguidores: r.seguidores } : p))).catch((e) => setErrorPublicacion(e instanceof Error ? e.message : 'No se pudo actualizar el seguimiento.'));
        return;
      }
    }
    alternarSeguir(publicacion.autor.id);
  }

  async function comentarEnPublicacion(id: string, texto: string) {
    if (!tienePermisoInterfaz(usuario?.role, 'interactuar_socialmente')) return null;
    if (!token || !/^[a-f\d]{24}$/i.test(id)) return null;
    try {
      const comentario = await crearComentarioApi(id, texto, token);
      const autor = (comentario.authorSnapshot ?? {}) as Record<string, unknown>;
      setPublicaciones((actuales) => actuales.map((p) => p.id === id ? { ...p, comentariosCount: (p.comentariosCount ?? 0) + 1 } : p));
      return {
        id: String(comentario._id ?? Date.now()),
        autor: {
          id: String(comentario.authorId ?? usuario?._id ?? ''), nombre: String(autor.displayName ?? autorActivo.nombre),
          usuario: String(autor.username ?? autorActivo.usuario), sede: (autor.campus ?? autorActivo.sede) as Sede,
          programa: String(autor.program ?? autorActivo.programa), verificado: Boolean(autor.isVerifiedPoli), color: autorActivo.color,
          avatarUrl: typeof autor.avatarUrl === 'string' ? autor.avatarUrl : null,
        },
        texto: String(comentario.text ?? texto), fecha: 'Ahora',
      };
    } catch (e) {
      setErrorPublicacion(e instanceof Error ? e.message : 'No se pudo guardar el comentario.');
      return null;
    }
  }

  async function cargarComentariosPublicacion(id: string) {
    if (!token || !/^[a-f\d]{24}$/i.test(id)) return [];
    try {
      const resultado = await listarComentariosApi(id, token);
      return resultado.comentarios.map((comentario) => {
        const autor = (comentario.authorSnapshot ?? {}) as Record<string, unknown>;
        return {
          id: String(comentario._id ?? ''), texto: String(comentario.text ?? ''), fecha: 'Reciente',
          solucion: Boolean(comentario.isAcceptedAnswer),
          autor: {
            id: String(comentario.authorId ?? ''), nombre: String(autor.displayName ?? 'Usuario'),
            usuario: String(autor.username ?? ''), sede: (autor.campus ?? 'MEDELLIN') as Sede,
            programa: String(autor.program ?? ''), verificado: Boolean(autor.isVerifiedPoli), color: '#1b5e20',
            avatarUrl: typeof autor.avatarUrl === 'string' ? autor.avatarUrl : null,
          },
        };
      });
    } catch (e) { setErrorPublicacion(e instanceof Error ? e.message : 'No se pudieron cargar los comentarios.'); throw e; }
  }

  async function reportarPublicacion(targetType: 'POST' | 'USER' | 'COMMENT', id: string, reason: string, details: string) {
    if (!token) return;
    try {
      const resultado = await crearReporteApi({ targetType, targetId: id, reason, details }, token);
      window.alert(resultado.duplicado ? 'Ya reportaste esta publicación; el equipo la revisará.' : 'Reporte enviado al equipo de moderación.');
    } catch (e) { window.alert(e instanceof Error ? e.message : 'No se pudo enviar el reporte.'); }
  }

  async function ejecutarAccionPublicacion(idPublicacion: string, accion: 'OCULTAR' | 'BANEAR', usuarioId: string) {
    if (!token || !tienePermisoInterfaz(usuario?.role, 'moderar_muro')) return;
    const esBaneo = accion === 'BANEAR';
    try {
      await ejecutarAccionModeracionApi({
        targetType: esBaneo ? 'USER' : 'POST',
        targetId: esBaneo ? usuarioId : idPublicacion,
        accion,
        reason: 'INCUMPLIMIENTO',
        details: esBaneo ? 'Incumplimiento de normas de la comunidad.' : 'Contenido ocultado tras revisión de moderación.',
      }, token);
      if (esBaneo) setPublicaciones((actuales) => actuales.filter((p) => p.autor.id !== usuarioId));
      else setPublicaciones((actuales) => actuales.filter((p) => p.id !== idPublicacion));
      setErrorPublicacion(esBaneo ? 'Baneo de 30 días aplicado y registrado.' : 'Publicación oculta y acción registrada.');
    } catch (error) {
      setErrorPublicacion(error instanceof Error ? error.message : 'No se pudo aplicar la medida de moderación.');
    }
  }

  async function publicar(datos: DatosNuevaPublicacion) {
    setErrorPublicacion('');
    if (!token) { setErrorPublicacion('Inicia sesión para publicar.'); return false; }
    try {
      const adjuntos: Awaited<ReturnType<typeof subirArchivoApi>>[] = [];
      for (const archivo of datos.archivos) adjuntos.push(await subirArchivoApi(archivo, token));
      const guardada = await crearPublicacionApi({
        hubChannel: datos.canal, title: datos.titulo || undefined, content: datos.texto,
        formato: datos.formato, opcionesEncuesta: datos.opcionesEncuesta,
        ubicacion: datos.ubicacion, fechaEvento: datos.fechaEvento,
        mediaUrls: adjuntos.map(a => a.url),
        ...(datos.canal === 'MERCADO' ? { marketMeta: { price: Number(datos.precio) || 0, status: 'AVAILABLE' as const } } : {}),
      }, token);
      const nueva = adaptarPublicacionApi(guardada);
      nueva.archivos?.forEach((archivo, i) => { archivo.nombre = adjuntos[i].nombreOriginal; });
      setPublicaciones((actuales) => [nueva, ...actuales.filter((p) => p.id !== nueva.id)]);
      setVista('inicio'); setFiltro('global');
      return true;
    } catch (e) {
      setErrorPublicacion(e instanceof Error ? e.message : 'No se pudo guardar la publicación.');
      return false;
    }
  }

  async function crearNuevoGrupoChat(datos: {
    nombre: string;
    descripcion: string;
    participantesIds: string[];
  }) {
    if (token) {
      try {
        const chat = await crearChatGrupoApi(datos.nombre, datos.participantesIds, token);
        const nuevo = adaptarChatApi(chat, usuario?._id ?? autorActivo.id);
        setChatsBase((prev) => [nuevo, ...prev.filter((item) => item.id !== nuevo.id)]);

        setChatActivo(nuevo.id);
        setVista('mensajes');
      } catch (e) { window.alert(e instanceof Error ? e.message : 'No se pudo crear el grupo.'); }
      return;
    }
  }

  const noLeidos = chats.reduce((total, chat) => total + chat.noLeidos, 0);
  const esModerador = tienePermisoInterfaz(usuario?.role, 'moderar_muro');
  const esAdmin = usuario?.role === 'ADMIN';
  const navegacionVisible = esModerador ? [
    ...NAVEGACION.filter((opcion) => opcion.vista === 'inicio' || opcion.vista === 'foros'),
    ...(Object.keys(SECCIONES_ADMIN) as SeccionAdmin[])
      .filter((id) => esAdmin || id === 'moderacion' || id === 'paginas')
      .map((id) => ({ vista: id, etiqueta: SECCIONES_ADMIN[id], icono: iconosGestion[id] })),
  ] : NAVEGACION;
  function navegar(vistaNueva: Vista) {
    setVista(vistaNueva);
    if (esAdmin) window.location.hash = vistaNueva;
  }

  if (!usuario) {
    return (
      <div className={`app${tema === 'oscuro' ? ' tema-oscuro' : ''}`}>
        <ModalAutenticacion
          abierto
          onCerrar={() => undefined}
          modoInicial="login"
          permitirCerrar={false}
        />
      </div>
    );
  }
  if (usuario.mustChangePassword) return <CambioContrasenaObligatorio />;
  function actualizarPublicacion(id: string, cambios: Partial<PublicacionSocial>) {
    const aplicar = (lista: PublicacionSocial[]) => lista.map((p) => p.id === id ? { ...p, ...cambios } : p);
    setPublicaciones(aplicar); setGuardadas(aplicar);
  }

  function renderTarjeta(publicacion: PublicacionSocial) {
    const { id } = publicacion;
    const guardada = guardadas.some((p) => p.id === id);
    return <TarjetaPublicacion key={autorActivo.id + ':' + id} publicacion={publicacion}
      actor={autorActivo} modoModeracion={esModerador} guardada={guardada}
      reaccionado={publicacion.reaccionado} likes={publicacion.likes} dislikes={publicacion.dislikes}
      reaccionTipo={publicacion.reaccionTipo} reaccionesPorTipo={publicacion.reaccionesPorTipo}
      siguiendo={publicacion.paginaId ? Boolean(paginasSociales.find((p) => p._id === publicacion.paginaId)?.siguiendo) : seguidos.includes(publicacion.autor.id)}
      onSeguir={() => alternarSeguirPublicacion(publicacion)} onLike={() => alternarLike(id)}
      onReaccion={(tipo) => alternarLike(id, tipo)} onComentar={(texto) => comentarEnPublicacion(id, texto)}
      onCargarComentarios={() => cargarComentariosPublicacion(id)} onReportar={esModerador ? undefined : reportarPublicacion}
      onVerificarPagina={esAdmin && publicacion.paginaId && token ? async verificada => {
        const {pagina} = await verificarPaginaApi(publicacion.paginaId!, verificada, token);
        setPublicaciones(actuales => actuales.map(p => p.paginaId === pagina._id ? {...p, autor:{...p.autor, verificado:pagina.isVerified}} : p));
        setPaginasSociales(actuales => actuales.map(p => p._id === pagina._id ? pagina : p));
      } : undefined}
      onAccionModeracion={(accion, autor) => ejecutarAccionPublicacion(id, accion, autor)}
      onVotar={async (opcion) => actualizarPublicacion(id, { resultadoEncuesta: await votarEncuesta(id, opcion, token!) })}
      onAceptar={async (comentarioId) => { await aceptarRespuesta(id, comentarioId, token!); actualizarPublicacion(id, { resuelto: true }); }}
      onEditar={async (contenido) => { await editarPublicacion(id, contenido, token!); actualizarPublicacion(id, { contenido }); }}
      onRetirar={async () => {
        await retirarPublicacion(id, token!);
        setPublicaciones((lista) => lista.filter((p) => p.id !== id)); setGuardadas((lista) => lista.filter((p) => p.id !== id));
      }}
      onCompartir={() => navigator.clipboard.writeText(new URL('/inicio?publicacion=' + encodeURIComponent(id), window.location.origin).href)}
      onGuardar={async () => {
        await guardarReferencia(id, !guardada, token!);
        setGuardadas((lista) => guardada ? lista.filter((p) => p.id !== id) : [publicacion, ...lista.filter((p) => p.id !== id)]);
      }}
    />;
  }

  function renderInicio() {
    return (
      <>
        <EncabezadoVista
          titulo="Inicio"
          subtitulo="Conecta con la comunidad del Poli en todas sus sedes."
        />


        {token && <EstadosUniversitarios key={token} token={token} puedePublicar={!esModerador} />}
        {esModerador ? <p className="nota-canal">Vista de moderación en solo lectura. Usa el menú ⋯ de una publicación para aplicar medidas.</p> : <CompositorPublicacion autor={autorActivo} paginas={paginasSociales.filter((p) => p.isVerified && p.propietarioId === usuario?._id)} onPublicar={publicar} />}
        {errorPublicacion && <p role="alert">{errorPublicacion}</p>}

        <div className="filtros" role="tablist" aria-label="Filtrar muro">
          {(
            [
              ['global', 'Todo el Poli'],
              ['sede', `Mi Sede · ${autorActivo.etiquetaSede ?? nombreDeSede(autorActivo.sede)}`],
              ['siguiendo', 'Siguiendo'],
            ] as Array<[Filtro, string]>
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={filtro === valor}
              className={`chip-filtro${filtro === valor ? ' activo' : ''}`}
              onClick={() => setFiltro(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <div className="filtros filtros-reacciones" role="group" aria-label="Filtrar por reacción">
          {([['TODAS','Todas'],['LIKE','Me gusta'],['DISLIKE','No me gusta'],['LOVE','Me encanta'],['FUN','Me divierte'],['AMAZED','Me asombra']] as const).map(([tipo, nombre]) => <button key={tipo} type="button" className={`chip-filtro${filtroReaccion === tipo ? ' activo' : ''}`} aria-pressed={filtroReaccion === tipo} onClick={() => setFiltroReaccion(tipo)}>{nombre}</button>)}
        </div>

        {consulta && (
          <p className="resultado-busqueda">
            Resultados para <strong>“{busqueda}”</strong> · {publicacionesFiltradas.length}
          </p>
        )}

        {filtro === 'siguiendo' && publicacionesFiltradas.length === 0 ? (
          <section className="tarjeta estado-vacio">
            <Icono nombre="personas" tamano={30} />
            <h3>Aún no sigues a nadie con publicaciones</h3>
            <p>Conecta con compañeros de tu sede y carrera para ver su actividad aquí.</p>
            <div className="estado-vacio-sugerencias">
              {sugerencias.slice(0, 4).map((sugerido) => (
                <button
                  key={sugerido.id}
                  type="button"
                  className="boton-secundario"
                  onClick={() => alternarSeguir(sugerido.id)}
                >
                  Seguir a {sugerido.nombre.split(' ')[0]}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="lista-publicaciones">
            {publicacionesFiltradas.map(renderTarjeta)}

            {publicacionesFiltradas.length === 0 && (
              <section className="tarjeta estado-vacio">
                <Icono nombre="buscar" tamano={30} />
                <h3>No encontramos publicaciones</h3>
                <p>Prueba con otra palabra clave o cambia el filtro del muro.</p>
              </section>
            )}
          </div>
        )}
      </>
    );
  }

  function renderForos() {
    return (
      <>
        <EncabezadoVista
          titulo="Foros"
          subtitulo="Discusiones organizadas por canal y facultad."
        />

        <div className="rejilla-canales">
          {CANALES_FORO.map((opcion) => {
            const total = publicaciones.filter(
              (publicacion) => publicacion.canal === opcion.canal
            ).length;
            return (
              <button
                key={opcion.canal}
                type="button"
                className={`tarjeta tarjeta-canal${
                  canalForo === opcion.canal ? ' activo' : ''
                }`}
                onClick={() => setCanalForo(opcion.canal)}
              >
                <span className={`icono-canal tono-${opcion.canal.toLowerCase()}`}>
                  <Icono nombre={opcion.icono} tamano={22} />
                </span>
                <strong>{opcion.titulo}</strong>
                <p>{opcion.descripcion}</p>
                <span className="canal-meta">{total} publicaciones</span>
              </button>
            );
          })}
        </div>

        <div className="cabecera-canal">
          <h2>{NOMBRE_CANAL[canalForo]}</h2>
          {canalForo === 'AVISOS' && (
            <span className="etiqueta-moderacion">Avisos institucionales</span>
          )}
        </div>

        {!esModerador && (canalForo !== 'AVISOS' || (autorActivo.tipoCuenta === 'PAGE' && autorActivo.verificado)) ? (
          <>
          <CompositorPublicacion
            key={canalForo}
            autor={autorActivo}
            paginas={paginasSociales.filter((p) => p.isVerified && (p.propietarioId === usuario?._id || usuario?.role === 'ADMIN'))}
            canalInicial={canalForo}
            onPublicar={publicar}
          />
          {errorPublicacion && <p role="alert">{errorPublicacion}</p>}
          </>
        ) : (
          <p className="nota-canal">
            Los avisos oficiales se publican desde cuentas institucionales autorizadas.
          </p>
        )}

        <div className="lista-publicaciones">
          {publicacionesForo.map(renderTarjeta)}
          {publicacionesForo.length === 0 && (
            <section className="tarjeta estado-vacio">
              <Icono nombre="foros" tamano={30} />
              <h3>Este canal aún no tiene publicaciones</h3>
              <p>Sé la primera persona en iniciar una conversación.</p>
            </section>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={`app${tema === 'oscuro' ? ' tema-oscuro' : ''}`}>
      {buscadorAbierto && <BusquedaGlobal tokenSocial={usuario.role === 'USER' && token ? token : undefined} cerrar={()=>abrirBuscador(false)}
        opciones={[
          ...(usuario.role === 'USER' ? paginasSociales.map(p=>({id:p._id,avatarUrl:p.avatarUrl,nombre:p.nombre,detalle:p.categoria,destino:'paginas' as const})) : []),
          ...publicaciones.map(p=>({id:p.id,avatarUrl:p.autor.avatarUrl,nombre:p.titulo || p.contenido || p.autor.nombre,detalle:p.autor.nombre,destino:'inicio' as const})),
        ]} elegir={r=>{
          abrirBuscador(false);
          if(r.destino === 'inicio') { window.location.assign((esAdmin ? '/admin' : '/inicio')+'?publicacion='+encodeURIComponent(r.id)); return; }
          elegirPagina(r.destino === 'paginas' ? r.id : ''); setBusqueda(r.nombre); navegar(r.destino);
        }}/>}
      {/* Banner de estado de sesión institucional */}
      <div className="barra-sesion-banner">
        <div className="info-usuario">
          <span className={`punto-conexion ${backendDisponible ? 'conectado' : 'desconectado'}`} />
          {esModerador ? <span>Conectado: <strong>{esAdmin ? 'Administración' : 'Equipo de moderación'}</strong></span> : <>
              <span>
                Conectado: <strong>{usuario.displayName}</strong> (@{usuario.username}) · Sede{' '}
                <strong>{usuario.campusLabel ?? nombreDeSede(usuario.campus)}</strong>
              </span>
              {usuario.isVerifiedPoli && <span className="insignia-poli">Verificado PJIC</span>}
              <span className="badge-rol">{usuario.accountLabel ?? nombreTipoCuenta(usuario.accountType)}</span>
              {usuario.role !== 'USER' && <span className="badge-rol">{nombreRolAcceso(usuario.role)}</span>}
            </>
          }
        </div>
        <div className="acciones-sesion">
          {token && <BandejaNotificaciones token={token} alAbrir={aviso => {
            if (aviso.refType === 'CHAT' && aviso.refId) { setChatActivo(aviso.refId); navegar('mensajes'); }
            else if (aviso.refType === 'PAGE') navegar('paginas');
            else if (aviso.refType === 'REPORT' && esModerador) navegar('moderacion');
            else if (aviso.refType === 'POST' && aviso.refId) window.location.assign('/inicio?publicacion=' + encodeURIComponent(aviso.refId));
          }} />}
          <SelectorIdentidad paginas={paginasSociales} />
            <>
              {!esModerador && <button
                type="button"
                className="boton-banner"
                onClick={() => setVista('perfil')}
              >
                Mi Perfil
              </button>}
              <button
                type="button"
                className="boton-banner"
                onClick={() => {
                  setModoAuthInicial('login');
                  setModalAuthAbierto(true);
                }}
              >
                Cambiar cuenta
              </button>
              <button
                type="button"
                className="boton-banner"
                onClick={cerrarSesion}
              >
                <Icono nombre="salir" tamano={14} />
                Cerrar sesión
              </button>
            </>

        </div>
      </div>

      <header className="barra-movil">
        <span className="marca-movil">
          <Icono nombre="graduacion" tamano={22} />
          Poli Social Network
        </span>
        <div className="barra-movil-acciones">
          <button type="button" className="boton-icono" aria-label="Buscar" onClick={() => abrirBuscador(true)}>
            <Icono nombre="buscar" tamano={20} />
          </button>
          <button
            type="button"
            className="boton-icono"
            onClick={() => setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'))}
            aria-label="Cambiar tema"
          >
            <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} tamano={20} />
          </button>
        </div>
      </header>

      <div className="disposicion">
        <aside className="columna-izquierda">
          <div className="marca">
            <span className="marca-icono">
              <Icono nombre="graduacion" tamano={26} />
            </span>
            <div>
              <strong>Poli Social Network</strong>
              <span>Comunidad PJIC</span>
            </div>
          </div>

          <nav className="navegacion-principal" aria-label="Navegación principal">
            {navegacionVisible.map((opcion) => (
              <BotonNavegacion
                key={opcion.vista}
                vista={opcion.vista}
                actual={vista}
                etiqueta={opcion.etiqueta}
                icono={opcion.icono}
                onClick={() => navegar(opcion.vista)}
              />
            ))}
          </nav>

          {!esModerador && <button type="button" className="boton-primario boton-crear" onClick={() => setVista('inicio')}>
            <Icono nombre="crear" tamano={20} />
            Crear publicación
          </button>}

          {!esModerador && <div className="resumen-izquierda">
            <div>
              <strong>{seguidos.length}</strong>
              <span>Siguiendo</span>
            </div>
            <div>
              <strong>{usuario ? usuario.followersCount : 142}</strong>
              <span>Seguidores</span>
            </div>
          </div>}

          <button
            type="button"
            className="nav-boton boton-tema"
            onClick={() => setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'))}
          >
            <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} tamano={21} />
            <span>{tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}</span>
          </button>

          {esModerador ? <div className="contenedor-perfil-mini identidad-moderacion"><strong>{nombreRolAcceso(usuario.role)}</strong><button type="button" onClick={cerrarSesion}><Icono nombre="salir" tamano={15} /> Cerrar sesión</button></div> : <div className="contenedor-perfil-mini">
            <button
              type="button"
              className="perfil-mini"
              onClick={() => {
                if (!usuario) {
                  setModoAuthInicial('login');
                  setModalAuthAbierto(true);
                } else {
                  setMenuPerfilAbierto((actual) => !actual);
                }
              }}
            >
              <Avatar nombre={autorActivo.nombre} color={autorActivo.color} tamano={40} />
              <span>
                <strong>{autorActivo.nombre}</strong>
                <small>@{autorActivo.usuario}</small>
              </span>
              <Icono nombre="mas" tamano={18} />
            </button>

            {menuPerfilAbierto && usuario && (
              <div className="menu-desplegable-perfil tarjeta">
                <button
                  type="button"
                  className="item-menu-perfil"
                  onClick={() => {
                    setVista('perfil');
                    setMenuPerfilAbierto(false);
                  }}
                >
                  <Icono nombre="perfil" tamano={16} />
                  Ver mi perfil
                </button>
                <button
                  type="button"
                  className="item-menu-perfil"
                  onClick={() => {
                    setModoAuthInicial('login');
                    setModalAuthAbierto(true);
                    setMenuPerfilAbierto(false);
                  }}
                >
                  <Icono nombre="usuario" tamano={16} />
                  Cambiar de cuenta
                </button>
                <button
                  type="button"
                  className="item-menu-perfil peligro"
                  onClick={() => {
                    cerrarSesion();
                    setMenuPerfilAbierto(false);
                  }}
                >
                  <Icono nombre="salir" tamano={16} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>}
        </aside>

        <main className="columna-central">
          {esAdmin && token && vistaGestion(vista) && <HerramientasAdministracion token={token} usuario={usuario} pestana={vista} setPestana={navegar} />}
          {usuario.role === 'MODERATOR' && token && vista === 'moderacion' && <PanelModeracion token={token} />}
          {usuario.role === 'MODERATOR' && token && vista === 'paginas' && <CrearPaginaInstitucional token={token} />}
          {consulta && usuario.role === 'USER' && ['inicio','foros','paginas','comunidades'].includes(vista) &&
            <nav className="filtros" aria-label="Buscar en">
              {(['inicio','paginas','comunidades'] as const).map((v,i)=><button key={v} className={'chip-filtro' + (vista === v ? ' activo' : '')} onClick={()=>navegar(v)}>{['Publicaciones','Páginas','Comunidades'][i]}</button>)}
            </nav>}
          {vista === 'inicio' && renderInicio()}
          {vista === 'foros' && renderForos()}
          {vista === 'comunidades' && token && usuario.role === 'USER' && <PanelComunidades
            key={usuario._id} token={token} usuario={usuario} contactos={usuariosChat} consulta={busqueda} cambiar={setBusqueda}
            alAbrirChat={(datos) => {
              const chat = adaptarChatApi(datos, usuario._id);
              setChatsBase((actuales) => [chat, ...actuales.filter((anterior) => anterior.id !== chat.id)]);
              setChatActivo(chat.id); setVista('mensajes');
            }} alSalirChat={(id) => setChatsBase((actuales) => actuales.filter((chat) => chat.id !== id))}
          />}
          {vista === 'mensajes' && token && usuario.role === 'USER' && <BandejaMensajes key={token} token={token} usuarioId={usuario._id} contactos={usuariosChat} chats={chats} activo={chatActivo}
            seleccionar={setChatActivo} crearGrupo={() => setModalCrearGrupoChatAbierto(true)}
            alCrear={(registro) => {
              const chat = adaptarChatApi(registro, usuario._id);
              setChatsBase(prev => [chat, ...prev.filter(item => item.id !== chat.id)]);
              setChatActivo(chat.id);
            }} />}
          {(vista === 'perfil' || vista === 'paginas') && tienePermisoInterfaz(usuario.role, 'ver_perfil_social') && token && <PerfilSocial paginaElegida={paginaElegida} consulta={busqueda} cambiar={setBusqueda} soloPaginas={vista === 'paginas'}
            usuario={usuario} token={token} publicaciones={publicaciones} guardadas={guardadas} respondidasIds={respondidasIds}
            paginas={paginasSociales} setPaginas={setPaginasSociales} setPublicaciones={setPublicaciones} mostrarPublicacion={renderTarjeta} />}
        </main>

        <aside className="columna-derecha">
          <button type="button" className="abrir-busqueda" onClick={()=>abrirBuscador(true)}><Icono nombre="buscar" tamano={19}/>Buscar en Poli Social Network</button>

          <section className="tarjeta panel-tarjeta">
            <h2>Tendencias del Poli</h2>
            <ul className="lista-tendencias">
              {tendencias.map((tendencia, indice) => (
                <li key={tendencia.etiqueta}>
                  <button type="button" onClick={() => setBusqueda(tendencia.etiqueta.slice(1))}>
                    <span className="tendencia-indice">{indice + 1}</span>
                    <span>
                      <strong>{tendencia.etiqueta}</strong>
                      <small>{tendencia.publicaciones}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {!esModerador && <><section className="tarjeta panel-tarjeta">
            <h2>Personas para conectar</h2>
            <ul className="lista-sugerencias">
              {sugerencias.slice(0, 4).map((sugerido) => {
                const siguiendo = seguidos.includes(sugerido.id);
                return (
                  <li key={sugerido.id}>
                    <Avatar nombre={sugerido.nombre} color={sugerido.color} tamano={40} />
                    <div className="sugerencia-datos">
                      <strong>
                        {sugerido.nombre}
                        {sugerido.verificado && <InsigniaVerificado tamano={13} />}
                      </strong>
                      <span>
                        {nombreDeSede(sugerido.sede)} · {sugerido.programa}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`boton-seguir${siguiendo ? ' siguiendo' : ''}`}
                      onClick={() => alternarSeguir(sugerido.id)}
                    >
                      {siguiendo ? 'Siguiendo' : 'Seguir'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="tarjeta panel-tarjeta panel-mensajes">
            <h2>Mensajes recientes</h2>
            {chats.slice(0, 3).map((chat) => (
              <button
                key={chat.id}
                type="button"
                className="mini-chat"
                onClick={() => {
                  setChatActivo(chat.id);
                  setVista('mensajes');
                }}
              >
                <span
                  className="avatar"
                  style={{ width: 34, height: 34, background: chat.color, fontSize: 12 }}
                >
                  {chat.iniciales}
                </span>
                <span>
                  <strong>{chat.nombre}</strong>
                  <small>{chat.ultimo}</small>
                </span>
                {chat.noLeidos > 0 && <span className="contador-no-leidos">{chat.noLeidos}</span>}
              </button>
            ))}
            <button type="button" className="enlace-ver-todo" onClick={() => setVista('mensajes')}>
              Ver todos los mensajes
            </button>
          </section>

          </>}
          <footer className="pie-derecha">
            <span>Poli Social Network · PJIC</span>
            <span>Normas</span>
            <span>Privacidad</span>
            <span>Ley 1581 de 2012</span>
          </footer>
        </aside>
      </div>

      <nav className="navegacion-movil" aria-label="Navegación móvil">
        {navegacionVisible.map((opcion) => {
          const activo = vista === opcion.vista;
          return (
            <button
              key={opcion.vista}
              type="button"
              className={activo ? 'activo' : ''}
              onClick={() => navegar(opcion.vista)}
            >
              <Icono nombre={opcion.icono} tamano={22} relleno={activo && opcion.vista === 'inicio'} />
              {opcion.vista === 'mensajes' && noLeidos > 0 && (
                <span className="punto-no-leidos">{noLeidos}</span>
              )}
              <span>{opcion.etiqueta}</span>
            </button>
          );
        })}
        {!esModerador && <button type="button" onClick={() => setVista('inicio')}>
          <Icono nombre="crear" tamano={24} />
          <span>Crear</span>
        </button>}
      </nav>

      <ModalAutenticacion
        abierto={modalAuthAbierto}
        onCerrar={() => setModalAuthAbierto(false)}
        modoInicial={modoAuthInicial}
      />


      <ModalCrearChatGrupo
        abierto={modalCrearGrupoChatAbierto}
        onCerrar={() => setModalCrearGrupoChatAbierto(false)}
        onCrear={crearNuevoGrupoChat}
        estudiantes={estudiantesParaGrupo}
      />
    </div>
  );
}
