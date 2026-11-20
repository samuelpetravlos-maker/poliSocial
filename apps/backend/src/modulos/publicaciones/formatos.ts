import { ErrorHttp } from '../../comun/errores';
import { arregloDeTextos, enumerado, textoOpcional } from '../../comun/validacion';

export const FORMATOS = ['NOTICIA', 'ENCUESTA', 'PREGUNTA', 'FORO', 'EVENTO'] as const;
export type FormatoPublicacion = typeof FORMATOS[number];

export interface EntradaFormato {
  formato?: unknown;
  opcionesEncuesta?: unknown;
  ubicacion?: unknown;
  fechaEvento?: unknown;
}

export function validarFormato(datos: EntradaFormato, ahora = new Date()) {
  const formato = enumerado(datos.formato ?? 'NOTICIA', 'formato', FORMATOS);
  const ubicacion = textoOpcional(datos.ubicacion, 'ubicación', { max: 120 }) || null;
  const opciones = arregloDeTextos(datos.opcionesEncuesta, 'opciones', 6, 80);
  if (formato === 'ENCUESTA') {
    const distintas = new Set(opciones.map((opcion) => opcion.normalize('NFC').toLocaleLowerCase('es')));
    if (opciones.length < 2 || distintas.size !== opciones.length) {
      throw new ErrorHttp(400, 'La encuesta requiere entre dos y seis opciones diferentes.');
    }
  } else if (opciones.length) {
    throw new ErrorHttp(400, 'Solo una encuesta admite opciones de voto.');
  }
  if (formato === 'EVENTO') {
    const fechaEvento = typeof datos.fechaEvento === 'string' ? new Date(datos.fechaEvento) : null;
    if (!fechaEvento || !Number.isFinite(fechaEvento.getTime()) || fechaEvento <= ahora || !ubicacion) {
      throw new ErrorHttp(400, 'Indica dónde se celebra el evento y selecciona una fecha futura.');
    }
    return { formato, ubicacion, fechaEvento };
  }
  return { formato, ubicacion, ...(opciones.length ? { opcionesEncuesta: opciones } : {}) };
}
