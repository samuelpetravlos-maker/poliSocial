'use client';

import { useCallback, useEffect, useState } from 'react';
import { listarReportesModeracionApi, resolverReporteModeracionApi, type ReporteModeracion } from '../servicios/servicio-api';

const NOMBRES_TIPO: Record<string, string> = {
  POST: 'Publicación', COMMENT: 'Comentario', USER: 'Cuenta', PAGE: 'Página', MESSAGE: 'Mensaje',
};
const NOMBRES_MOTIVO: Record<string, string> = {
  SPAM: 'Correo o contenido no solicitado', ACOSO: 'Acoso', CONTENIDO_INAPROPIADO: 'Contenido inapropiado',
  FRAUDE: 'Fraude', SUPLANTACION: 'Suplantación', OTRO: 'Otro motivo', INCUMPLIMIENTO: 'Incumplimiento de normas',
};
const NOMBRES_ESTADO: Record<string, string> = {
  PENDING: 'Pendiente', REVIEWING: 'En revisión', RESOLVED: 'Resuelto', DISMISSED: 'Descartado',
};

export function PanelModeracion({ token }: { token: string }) {
  const [reportes, setReportes] = useState<ReporteModeracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try { setReportes((await listarReportesModeracionApi(token)).reportes); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los reportes.'); }
    finally { setCargando(false); }
  }, [token]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function resolver(reporte: ReporteModeracion, estado: 'REVIEWING' | 'RESOLVED' | 'DISMISSED', accion: 'OCULTAR' | 'ELIMINAR' | 'BANEAR' | 'NINGUNA') {
    setError('');
    try {
      await resolverReporteModeracionApi(reporte._id, estado, accion, token);
      setMensaje(estado === 'REVIEWING' ? 'Reporte asignado para revisión.' : 'Reporte actualizado.');
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo resolver el reporte.'); }
  }

  return (
    <section className="moderacion-social">
      <header className="encabezado-vista"><div><h1>Moderación</h1><p>Revisa reportes y cuida la comunidad universitaria.</p></div><button type="button" className="boton-secundario" onClick={() => void cargar()}>Actualizar</button></header>
      {error && <div className="mensaje-error-auth" role="alert">{error}</div>}
      {mensaje && <p role="status">{mensaje}</p>}
      {cargando ? <section className="tarjeta estado-vacio"><p>Cargando reportes…</p></section> : reportes.length === 0 ? <section className="tarjeta estado-vacio"><h3>No hay reportes pendientes</h3><p>Los casos nuevos aparecerán aquí para su revisión.</p></section> : reportes.map((reporte) => (
        <article className="tarjeta moderacion-social-reporte" key={reporte._id}>
          <div><strong>{NOMBRES_TIPO[reporte.targetType] ?? 'Contenido'} · {NOMBRES_MOTIVO[reporte.reason] ?? 'Otro motivo'}</strong><p>Reportó {reporte.reporterName} · {NOMBRES_ESTADO[reporte.status] ?? 'Pendiente'}</p><small>{reporte.details || `Elemento ${reporte.targetId}`}</small></div>
          <div className="moderacion-social-acciones">
            <button type="button" className="boton-secundario" onClick={() => void resolver(reporte, 'REVIEWING', 'NINGUNA')}>Tomar caso</button>
            {['POST', 'COMMENT'].includes(reporte.targetType) && <button type="button" className="boton-secundario peligro" onClick={() => void resolver(reporte, 'RESOLVED', 'OCULTAR')}>Ocultar contenido</button>}
            {reporte.targetType === 'USER' && <button type="button" className="boton-secundario peligro" onClick={() => void resolver(reporte, 'RESOLVED', 'BANEAR')}>Banear 30 días</button>}
            <button type="button" className="boton-secundario" onClick={() => void resolver(reporte, 'DISMISSED', 'NINGUNA')}>Descartar</button>
          </div>
        </article>
      ))}
    </section>
  );
}
