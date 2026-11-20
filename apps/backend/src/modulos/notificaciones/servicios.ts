import { NotificacionesRepositorio } from './notificaciones.repositorio';

export class NotificacionesServicio {
  constructor(private readonly repositorio: NotificacionesRepositorio) {}

  async listar(usuarioId: string, limite = 30) {
    const notificaciones = await this.repositorio.listar(usuarioId, limite);
    return {
      notificaciones,
      noLeidas: await this.repositorio.contarNoLeidas(usuarioId),
    };
  }

  marcarLeida(usuarioId: string, id: string) {
    return this.repositorio.marcarLeida(usuarioId, id);
  }

  marcarTodasLeidas(usuarioId: string) {
    return this.repositorio.marcarTodasLeidas(usuarioId);
  }
}
