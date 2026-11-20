export {
  alternarMembresiaApi,
  crearChatComunidadApi,
  crearComunidadApi,
  listarComunidadesApi,
  listarSolicitudesComunidadApi,
  resolverSolicitudComunidadApi,
} from '@/servicios/api-cliente';

import { clienteHttp } from '@/servicios/api-cliente';

export const invitarComunidad = (id: string, usuarioId: string, token: string) =>
  clienteHttp(`/comunidades/${encodeURIComponent(id)}/invitaciones`, {
    method: 'POST', body: JSON.stringify({ usuarioId }),
  }, token);
