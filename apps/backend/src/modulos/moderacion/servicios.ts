import { ObjectId } from 'mongodb';
import { ErrorHttp } from '../../comun/errores';
import { desconectarUsuario, emitirNotificacion } from '../../infraestructura/tiempo-real/eventos';
import { NotificacionesRepositorio } from '../notificaciones/notificaciones.repositorio';
import { Usuario } from '../usuarios/usuario.modelo';
import {
  ESTADOS_REPORTE,
  EstadoReporte,
  MOTIVOS_REPORTE,
  MotivoReporte,
  ReporteColeccion,
  TIPOS_OBJETIVO_REPORTE,
  TipoObjetivoReporte,
} from './colecciones';
import { ModeracionRepositorio } from './repositorio';

type AccionDirecta = 'OCULTAR' | 'BANEAR';
type AccionReporte = 'OCULTAR' | 'ELIMINAR' | 'BANEAR' | 'NINGUNA';
const ADMIN_FUNDADOR_ID = process.env.ADMIN_FUNDADOR_ID ?? 'local_admin';
const DURACION_BANEO_DIAS = 30;
const NOMBRES_TIPO_REPORTE: Record<TipoObjetivoReporte, string> = {
  POST: 'publicación', COMMENT: 'comentario', USER: 'cuenta', PAGE: 'página', MESSAGE: 'mensaje',
};
const NOMBRES_MOTIVO_REPORTE: Record<MotivoReporte, string> = {
  SPAM: 'spam', ACOSO: 'acoso', CONTENIDO_INAPROPIADO: 'contenido inapropiado',
  FRAUDE: 'fraude', SUPLANTACION: 'suplantación', OTRO: 'otro motivo',
};

function valorPermitido<T extends string>(valor: unknown, opciones: readonly T[]): valor is T {
  return typeof valor === 'string' && opciones.some((opcion) => opcion === valor);
}

export class ModeracionServicio {
  constructor(
    private readonly repositorio: ModeracionRepositorio,
    private readonly notificaciones: NotificacionesRepositorio
  ) {}

  async crearReporte(usuario: Usuario, entrada: Record<string, unknown>) {
    const tipo = entrada.targetType;
    const id = entrada.targetId;
    const motivo = entrada.reason;
    if (!valorPermitido(tipo, TIPOS_OBJETIVO_REPORTE) || typeof id !== 'string' || !id || id.length > 200 || !valorPermitido(motivo, MOTIVOS_REPORTE)) {
      throw new ErrorHttp(400, 'Selecciona un contenido y motivo válidos.');
    }
    if (tipo === 'USER' && id === usuario._id) throw new ErrorHttp(400, 'No puedes reportar tu propia cuenta.');
    if (!(await this.repositorio.existeObjetivo(tipo, id))) throw new ErrorHttp(404, 'El elemento reportado no existe.');

    const existente = await this.repositorio.buscarReporteActivo(usuario._id, tipo, id);
    if (existente) {
      await this.notificarModeradores(String(existente._id), usuario, tipo, motivo);
      return { reporte: existente, duplicado: true };
    }

    const ahora = new Date();
    const reporte = await this.repositorio.crearReporte({
      reporterId: usuario._id,
      reporterName: usuario.displayName,
      targetType: tipo,
      targetId: id,
      reason: motivo,
      details: typeof entrada.details === 'string' ? entrada.details.trim().slice(0, 500) : '',
      status: 'PENDING',
      assignedTo: null,
      resolution: null,
      createdAt: ahora,
      updatedAt: ahora,
    });
    await this.notificarModeradores(String(reporte._id), usuario, tipo, motivo);
    return { reporte, duplicado: false };
  }

  async ejecutarAccion(usuario: Usuario, entrada: Record<string, unknown>) {
    const tipo = entrada.targetType;
    const id = entrada.targetId;
    const accion = entrada.accion;
    if (!['POST', 'USER'].includes(String(tipo)) || typeof id !== 'string' || !id || !['OCULTAR', 'BANEAR'].includes(String(accion))) {
      throw new ErrorHttp(400, 'La acción de moderación no es válida.');
    }
    if (tipo === 'POST' && accion !== 'OCULTAR') throw new ErrorHttp(400, 'Las publicaciones solo pueden ocultarse desde este menú.');
    if (tipo === 'USER' && accion !== 'BANEAR') throw new ErrorHttp(400, 'La acción elegida no aplica a la cuenta.');

    const motivo: MotivoReporte | 'INCUMPLIMIENTO' = valorPermitido(entrada.reason, MOTIVOS_REPORTE) ? entrada.reason : 'INCUMPLIMIENTO';
    const detalles = typeof entrada.details === 'string' ? entrada.details.trim().slice(0, 500) : '';
    if (tipo === 'POST') {
      if (!(await this.repositorio.ocultarPublicacion(id))) throw new ErrorHttp(404, 'La publicación no existe o ya no está disponible.');
    } else {
      await this.banearCuenta(usuario, id, motivo, detalles || 'Acción de moderación desde la publicación.');
    }

    await this.repositorio.registrarAuditoria({
      actorId: usuario._id,
      actorRole: usuario.role,
      action: tipo === 'POST' ? 'HIDE_POST' : 'BAN_USER',
      targetType: String(tipo),
      targetId: id,
      details: { reason: motivo, details: detalles, durationDays: tipo === 'USER' ? DURACION_BANEO_DIAS : null },
    });
    return { aplicada: true, duracionDias: tipo === 'USER' ? DURACION_BANEO_DIAS : null };
  }

  listarReportes(estadoSolicitado: unknown) {
    const estado = valorPermitido(estadoSolicitado, ESTADOS_REPORTE) ? estadoSolicitado : undefined;
    return this.repositorio.listarReportes(estado);
  }

  async resolverReporte(usuario: Usuario, id: string, entrada: Record<string, unknown>) {
    if (!ObjectId.isValid(id)) throw new ErrorHttp(404, 'Reporte no encontrado.');
    const reporte = await this.repositorio.buscarReporte(new ObjectId(id));
    if (!reporte) throw new ErrorHttp(404, 'Reporte no encontrado.');

    const estado = entrada.status;
    const accion = entrada.accion;
    if (!valorPermitido(estado, ESTADOS_REPORTE) || estado === 'PENDING') throw new ErrorHttp(400, 'Estado de resolución no válido.');
    if (accion !== undefined && !['OCULTAR', 'ELIMINAR', 'BANEAR', 'NINGUNA'].includes(String(accion))) {
      throw new ErrorHttp(400, 'Acción de moderación no válida.');
    }

    if (accion && accion !== 'NINGUNA') await this.aplicarAccionSobreReporte(usuario, reporte, accion as AccionReporte);
    const resolucion = typeof entrada.resolution === 'string' ? entrada.resolution.trim().slice(0, 500) : '';
    const actualizado = await this.repositorio.actualizarResolucion(reporte._id!, estado, usuario._id, resolucion);
    await this.repositorio.registrarAuditoria({
      actorId: usuario._id,
      actorRole: usuario.role,
      action: accion === 'BANEAR' ? 'BAN_USER' : `REPORT_${estado}`,
      targetType: reporte.targetType,
      targetId: String(reporte.targetId),
      details: { accion: accion ?? 'NINGUNA', resolution: resolucion },
    });
    return { reporte: actualizado };
  }

  private async aplicarAccionSobreReporte(usuario: Usuario, reporte: ReporteColeccion, accion: AccionReporte) {
    if (accion === 'BANEAR') {
      if (reporte.targetType !== 'USER') throw new ErrorHttp(400, 'Solo puedes banear una cuenta reportada como cuenta.');
      const objetivo = await this.repositorio.buscarUsuario(String(reporte.targetId));
      if (!objetivo || objetivo.status !== 'ACTIVE' || objetivo.accountType === 'PAGE') {
        throw new ErrorHttp(404, 'La cuenta reportada no es una cuenta personal activa.');
      }
      if (usuario.role === 'MODERATOR' && objetivo.role !== 'USER') throw new ErrorHttp(403, 'Los moderadores solo pueden banear usuarios.');
      if (objetivo.role === 'ADMIN' && usuario._id !== ADMIN_FUNDADOR_ID) throw new ErrorHttp(403, 'Solo el administrador fundador puede moderar cuentas ADMIN.');
      await this.banearCuenta(usuario, objetivo._id, 'INCUMPLIMIENTO', 'Baneo por reporte de moderación.', true);
      return;
    }
    if (accion !== 'OCULTAR' && accion !== 'ELIMINAR') throw new ErrorHttp(400, 'La acción seleccionada no aplica a este reporte.');
    if (reporte.targetType !== 'POST' && reporte.targetType !== 'COMMENT') {
      throw new ErrorHttp(400, 'La acción seleccionada no aplica a este tipo de reporte.');
    }
    if (!(await this.repositorio.resolverContenidoReportado(reporte.targetType, String(reporte.targetId), accion))) {
      throw new ErrorHttp(404, 'El contenido reportado no existe o no se puede modificar.');
    }
  }

  private async banearCuenta(usuario: Usuario, id: string, motivo: string, detalles: string, porReporte = false) {
    if (id === usuario._id) throw new ErrorHttp(400, 'No puedes banear tu propia cuenta.');
    const objetivo = await this.repositorio.buscarUsuario(id, true);
    if (!objetivo || objetivo.accountType === 'PAGE' || (!porReporte && objetivo.role !== 'USER')) {
      throw new ErrorHttp(403, 'Moderación solo puede banear cuentas personales activas.');
    }
    if (usuario.role === 'MODERATOR' && objetivo.role !== 'USER') throw new ErrorHttp(403, 'Los moderadores solo pueden banear usuarios.');
    if (objetivo.role === 'ADMIN' && usuario._id !== ADMIN_FUNDADOR_ID) throw new ErrorHttp(403, 'Solo el administrador fundador puede moderar cuentas ADMIN.');
    if (objetivo.banUntil && objetivo.banUntil > new Date()) throw new ErrorHttp(409, 'La cuenta ya tiene un baneo activo.');
    const termina = new Date(Date.now() + DURACION_BANEO_DIAS * 24 * 60 * 60 * 1000);
    await this.repositorio.aplicarBaneo(objetivo._id, motivo, detalles, termina);
    desconectarUsuario(objetivo._id);
  }

  private async notificarModeradores(reporteId: string, usuario: Usuario, tipo: TipoObjetivoReporte, motivo: MotivoReporte) {
    const moderadores = await this.repositorio.listarModeradoresActivos();
    for (const moderadorId of moderadores) {
      if (await this.repositorio.existeNotificacionReporte(moderadorId, reporteId)) continue;
      const notificacion = await this.notificaciones.crear({
        userId: moderadorId,
        type: 'CONTENT_REPORTED',
        refType: 'REPORT',
        refId: reporteId,
        actorSnapshot: { uid: usuario._id, displayName: usuario.displayName, avatarUrl: usuario.avatarUrl ?? null },
        summary: `Reporte de ${NOMBRES_TIPO_REPORTE[tipo]} · ${NOMBRES_MOTIVO_REPORTE[motivo]}`,
      });
      emitirNotificacion(moderadorId, notificacion);
    }
  }
}
