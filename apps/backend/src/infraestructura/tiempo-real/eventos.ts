import { Db, ObjectId } from 'mongodb';
import { Server, Socket } from 'socket.io';
import { resolverIdentidadSocial } from '../../modulos/paginas/identidades';
import { verificarToken } from '../../comun/autenticacion';
import { Usuario } from '../../modulos/usuarios/usuario.modelo';

let servidorEventos: Server | null = null;

export function configurarEventos(servidor: Server, baseDeDatos: Db): void {
  servidorEventos = servidor;

  servidor.use(async (socket, siguiente) => {
    try {
      const cabecera = socket.handshake.headers.authorization;
      const token: string =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof cabecera === 'string' && cabecera.startsWith('Bearer ')
          ? cabecera.slice('Bearer '.length)
          : '');

      if (!token) {
        siguiente(new Error('No autorizado.'));
        return;
      }

      const identidad = await verificarToken(token);
      const usuario = await baseDeDatos.collection<Usuario>('users').findOne({ _id: identidad.usuarioId });
      if (!usuario || usuario.status !== 'ACTIVE') {
        siguiente(new Error('La cuenta no está activa.'));
        return;
      }
      if (usuario.banUntil && usuario.banUntil > new Date()) {
        siguiente(new Error('La cuenta está baneada.'));
        return;
      }
      if (usuario.mustChangePassword) {
        siguiente(new Error('Debes cambiar tu contraseña para continuar.'));
        return;
      }
      if (usuario.localAuth && !identidad.tokenLocal) {
        siguiente(new Error('La sesión fue invalidada. Inicia sesión de nuevo.'));
        return;
      }
      if (identidad.tokenLocal && (identidad.sessionVersion ?? 0) !== (usuario.sessionVersion ?? 0)) {
        siguiente(new Error('La sesión fue cerrada por un cambio de seguridad.'));
        return;
      }
      const activo = await resolverIdentidadSocial(baseDeDatos, usuario, identidad.paginaId);
      socket.data.usuarioId = activo._id;
      await socket.join(`cuenta:${identidad.usuarioId}`);
      socket.data.rol = usuario.role;
      siguiente();
    } catch {
      siguiente(new Error('No autorizado.'));
    }
  });

  servidor.on('connection', async (socket: Socket) => {
    const usuarioId = socket.data.usuarioId as string;
    socket.join(`usuario:${usuarioId}`);

    socket.on('escribiendo', async (datos: { chatId?: string; escribiendo?: boolean }) => {
      if (socket.data.rol !== 'USER') return;
      if (!datos?.chatId || !ObjectId.isValid(datos.chatId)) return;
      const pertenece = await baseDeDatos.collection('chats').findOne({
        _id: new ObjectId(datos.chatId),
        participantIds: usuarioId,
      });
      if (!pertenece) return;
      const destinos = (pertenece.participantIds as string[]).filter(id => id !== usuarioId).map(id => 'usuario:' + id);
      if (!destinos.length) return;
      socket.to(destinos).emit('escribiendo', {
        chatId: datos.chatId,
        usuarioId,
        escribiendo: datos.escribiendo !== false,
      });
    });
  });
}

export function salirDeSalaChat(usuarioId: string, chatId: string) {
  servidorEventos?.in(`usuario:${usuarioId}`).socketsLeave(`chat:${chatId}`);
}

export function desconectarUsuario(usuarioId: string): void {
  servidorEventos?.in([`usuario:${usuarioId}`, `cuenta:${usuarioId}`]).disconnectSockets(true);
}

export function emitirMensajeNuevo(
  chatId: string,
  participantes: string[],
  mensaje: unknown
): void {
  if (!servidorEventos) return;
  servidorEventos.to(participantes.map(id => 'usuario:' + id)).emit('mensaje:nuevo', mensaje);
  for (const participante of participantes) {
    servidorEventos.to(`usuario:${participante}`).emit('chat:actualizado', { chatId });
  }
}

export function emitirPublicacionNueva(publicacion: unknown): void {
  if (!servidorEventos) return;
  servidorEventos.emit('publicacion:nueva', publicacion);
}

export function emitirComentarioNuevo(postId: string, comentario: unknown): void {
  if (!servidorEventos) return;
  servidorEventos.emit('publicacion:comentario', { postId, comentario });
}

export function emitirNotificacion(usuarioId: string, notificacion: unknown): void {
  if (!servidorEventos) return;
  servidorEventos.to(`usuario:${usuarioId}`).emit('notificacion:nueva', notificacion);
}
