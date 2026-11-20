import 'dotenv/config';
import { crearAplicacion } from './infraestructura/http/aplicacion';
import { conectarBaseDeDatos } from './infraestructura/base_datos/conexion';
import { iniciarServidor } from './infraestructura/http/servidor-http';

async function iniciar(): Promise<void> {
  const baseDeDatos = await conectarBaseDeDatos();
  const aplicacion = crearAplicacion(baseDeDatos);
  const puerto = Number(process.env.PORT ?? process.env.PUERTO ?? 3001);
  iniciarServidor(aplicacion, puerto, baseDeDatos);
}

iniciar().catch((error: unknown) => {
  console.error('No fue posible iniciar Poli Social Network:', error);
  process.exitCode = 1;
});
