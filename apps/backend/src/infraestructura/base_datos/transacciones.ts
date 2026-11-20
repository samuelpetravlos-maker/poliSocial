import { ClientSession, Db } from 'mongodb';

function transaccionNoSoportada(error: unknown): boolean {
  const codigo = (error as { code?: number }).code;
  const mensaje = (error as { message?: string }).message ?? '';
  return codigo === 20 || /replica set|Transaction numbers/i.test(mensaje);
}

export async function enTransaccion<T>(
  baseDeDatos: Db,
  operacion: (sesion: ClientSession | undefined) => Promise<T>
): Promise<T> {
  const sesion = baseDeDatos.client.startSession();

  try {
    let resultado: T | undefined;
    await sesion.withTransaction(async () => {
      resultado = await operacion(sesion);
    });
    return resultado as T;
  } catch (error) {
    if (transaccionNoSoportada(error)) {
      return operacion(undefined);
    }
    throw error;
  } finally {
    await sesion.endSession();
  }
}
