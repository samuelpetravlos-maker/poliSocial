import { ErrorHttp } from './errores';

interface OpcionesTexto {
  min?: number;
  max?: number;
}

export function textoRequerido(valor: unknown, campo: string, opciones: OpcionesTexto = {}): string {
  const { min = 1, max = 5000 } = opciones;
  if (typeof valor !== 'string') {
    throw new ErrorHttp(400, `El campo ${campo} es obligatorio.`);
  }
  const limpio = valor.trim();
  if (limpio.length < min) {
    throw new ErrorHttp(400, `El campo ${campo} debe tener al menos ${min} caracteres.`);
  }
  if (limpio.length > max) {
    throw new ErrorHttp(400, `El campo ${campo} no puede superar ${max} caracteres.`);
  }
  return limpio;
}

export function textoOpcional(valor: unknown, campo: string, opciones: OpcionesTexto = {}): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return textoRequerido(valor, campo, { min: 0, ...opciones });
}

export function enumerado<T extends string>(
  valor: unknown,
  campo: string,
  permitidos: readonly T[]
): T {
  if (typeof valor !== 'string' || !permitidos.includes(valor as T)) {
    throw new ErrorHttp(400, `El campo ${campo} debe ser uno de: ${permitidos.join(', ')}.`);
  }
  return valor as T;
}

export function enteroEnRango(valor: unknown, campo: string, min: number, max: number): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw new ErrorHttp(400, `El campo ${campo} debe ser un entero entre ${min} y ${max}.`);
  }
  return numero;
}

export function numeroNoNegativo(valor: unknown, campo: string): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new ErrorHttp(400, `El campo ${campo} debe ser un número mayor o igual a cero.`);
  }
  return numero;
}

export function arregloDeTextos(valor: unknown, campo: string, maximo: number, longitudMaxima = 60): string[] {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    throw new ErrorHttp(400, `El campo ${campo} debe ser un arreglo.`);
  }
  if (valor.length > maximo) {
    throw new ErrorHttp(400, `El campo ${campo} admite máximo ${maximo} elementos.`);
  }
  return valor.map((elemento, indice) =>
    textoRequerido(elemento, `${campo}[${indice}]`, { max: longitudMaxima })
  );
}

export function arregloDeIdentificadores(valor: unknown, campo: string, maximo: number): string[] {
  const identificadores = arregloDeTextos(valor, campo, maximo, 128);
  return [...new Set(identificadores)];
}

export function booleano(valor: unknown, campo: string, porDefecto = false): boolean {
  if (valor === undefined || valor === null) return porDefecto;
  if (typeof valor !== 'boolean') {
    throw new ErrorHttp(400, `El campo ${campo} debe ser booleano.`);
  }
  return valor;
}

export function esCorreoValido(correo: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo);
}

export function escaparExpresionRegular(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
