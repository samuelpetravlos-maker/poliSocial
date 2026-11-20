import { ErrorHttp } from '../../comun/errores';

type CredencialesFirebase = { idToken?: string; error?: { message?: string } };

async function solicitarToken(accion: string, claveApi: string, cuerpo: Record<string, unknown>): Promise<string> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${accion}?key=${encodeURIComponent(claveApi)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ErrorHttp(503, 'El proveedor de identidad institucional no responde.');
  }
  const datos = await respuesta.json() as CredencialesFirebase;
  if (!respuesta.ok || !datos.idToken) {
    if (accion === 'signInWithPassword') throw new ErrorHttp(401, 'Verifica la contraseña actual de tu cuenta institucional.');
    throw new ErrorHttp(400, 'El proveedor institucional rechazó el cambio de contraseña.');
  }
  return datos.idToken;
}

export async function cambiarClaveFirebase(email: string, actual: string, nueva: string) {
  const claveApi = process.env.FIREBASE_API_KEY;
  if (!claveApi) throw new ErrorHttp(503, 'El proveedor de identidad institucional no está configurado.');
  const idToken = await solicitarToken('signInWithPassword', claveApi, { email, password: actual, returnSecureToken: true });
  return solicitarToken('update', claveApi, { idToken, password: nueva, returnSecureToken: true });
}
