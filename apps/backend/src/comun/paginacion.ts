import { ErrorHttp } from './errores';

export interface CursorFechaId {
  fecha: Date;
  id: string;
}

export function codificarCursor(fecha: Date, id: string): string {
  return Buffer.from(JSON.stringify({ f: fecha.toISOString(), i: id })).toString('base64url');
}

export function decodificarCursor(valor: unknown): CursorFechaId | null {
  if (typeof valor !== 'string' || valor.length === 0) return null;
  try {
    const datos = JSON.parse(Buffer.from(valor, 'base64url').toString('utf8')) as {
      f?: unknown;
      i?: unknown;
    };
    if (typeof datos.f !== 'string' || typeof datos.i !== 'string') return null;
    const fecha = new Date(datos.f);
    if (Number.isNaN(fecha.getTime())) return null;
    return { fecha, id: datos.i };
  } catch {
    return null;
  }
}

export function leerLimite(valor: unknown, porDefecto = 15, maximo = 50): number {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new ErrorHttp(400, 'El límite de paginación debe ser un entero positivo.');
  }
  return Math.min(numero, maximo);
}
