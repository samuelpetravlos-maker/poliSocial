import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { ErrorHttp } from './errores';

const EMISOR = 'polihub-local';
const DURACION_TOKEN_SEGUNDOS = 60 * 60 * 12;

function derivarClave(contrasena: string, sal: Buffer, longitud: number, opciones: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(contrasena, sal, longitud, opciones, (error, clave) => error ? reject(error) : resolve(clave));
  });
}

function secretoToken(): string {
  const secreto = process.env.AUTH_TOKEN_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error('AUTH_TOKEN_SECRET debe tener al menos 32 caracteres.');
  }
  return secreto;
}

export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const parametros = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
  const clave = await derivarClave(contrasena, sal, 64, parametros);
  return `scrypt$${parametros.N}$${parametros.r}$${parametros.p}$${sal.toString('hex')}$${clave.toString('hex')}`;
}

export async function verificarContrasena(contrasena: string, hash: string): Promise<boolean> {
  const partes = hash.split('$');
  const algoritmo = partes[0];
  const formatoAnterior = partes.length === 3;
  const n = formatoAnterior ? 2 ** 14 : Number(partes[1]);
  const r = formatoAnterior ? 8 : Number(partes[2]);
  const p = formatoAnterior ? 1 : Number(partes[3]);
  const salHex = formatoAnterior ? partes[1] : partes[4];
  const claveHex = formatoAnterior ? partes[2] : partes[5];
  if (algoritmo !== 'scrypt' || !salHex || !claveHex || !Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const claveEsperada = Buffer.from(claveHex, 'hex');
  const claveRecibida = await derivarClave(contrasena, Buffer.from(salHex, 'hex'), claveEsperada.length, { N: n, r, p, maxmem: 256 * 1024 * 1024 });
  return claveEsperada.length === claveRecibida.length && timingSafeEqual(claveEsperada, claveRecibida);
}

export function crearTokenLocal(usuarioId: string, versionSesion = 0, paginaId?: string, expiracionTitular?: number): string {
  const ahora = Math.floor(Date.now() / 1000);
  const codificar = (valor: object) => Buffer.from(JSON.stringify(valor)).toString('base64url');
  const cabecera = codificar({ alg: 'HS256', typ: 'JWT' });
  const carga = codificar({
    sub: usuarioId,
    ver: versionSesion,
    ...(paginaId ? { paginaId } : {}),
    iss: EMISOR,
    iat: ahora,
    exp: Math.min(ahora + DURACION_TOKEN_SEGUNDOS, expiracionTitular ?? Infinity),
  });
  const contenido = `${cabecera}.${carga}`;
  const firma = createHmac('sha256', secretoToken()).update(contenido).digest('base64url');
  return `${contenido}.${firma}`;
}

export function verificarTokenLocal(token: string): { usuarioId: string; versionSesion: number; paginaId?: string; expira: number } | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  try {
    const [cabecera, carga, firma] = partes;
    const firmaEsperada = createHmac('sha256', secretoToken())
      .update(`${cabecera}.${carga}`)
      .digest();
    const firmaRecibida = Buffer.from(firma, 'base64url');
    if (
      firmaEsperada.length !== firmaRecibida.length ||
      !timingSafeEqual(firmaEsperada, firmaRecibida)
    ) {
      return null;
    }

    const tokenDatos = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8')) as {
      paginaId?: unknown;
      sub?: unknown;
      ver?: unknown;
      iss?: unknown;
      exp?: unknown;
    };
    if (
      tokenDatos.iss !== EMISOR ||
      typeof tokenDatos.sub !== 'string' ||
      typeof tokenDatos.exp !== 'number' ||
      tokenDatos.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { expira: tokenDatos.exp, paginaId: typeof tokenDatos.paginaId === 'string' ? tokenDatos.paginaId : undefined, usuarioId: tokenDatos.sub, versionSesion: typeof tokenDatos.ver === 'number' ? tokenDatos.ver : 0 };
  } catch {
    return null;
  }
}

export function validarNuevaContrasena(contrasena: unknown): string {
  if (typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 128) {
    throw new ErrorHttp(400, 'La nueva contraseña debe tener entre 8 y 128 caracteres.');
  }
  return contrasena;
}
