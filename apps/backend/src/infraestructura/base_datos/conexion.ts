import { Db, MongoClient } from 'mongodb';

export async function conectarBaseDeDatos(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const nombre = process.env.MONGODB_BASE_DATOS ?? 'polihub';
  if (!uri) throw new Error('Falta configurar MONGODB_URI.');

  const cliente = new MongoClient(uri);
  await cliente.connect();
  return cliente.db(nombre);
}
