import { createServer } from 'node:http';
import { Express } from 'express';
import { Db } from 'mongodb';
import { Server } from 'socket.io';
import { configurarEventos } from '../tiempo-real/eventos';
import { obtenerOrigenWebPermitido } from '../../comun/configuracion';

export function iniciarServidor(aplicacion: Express, puerto: number, baseDeDatos: Db): void {
  const servidor = createServer(aplicacion);
  const eventos = new Server(servidor, { cors: { origin: obtenerOrigenWebPermitido() } });

  configurarEventos(eventos, baseDeDatos);

  servidor.listen(puerto, () => console.log(`Poli Social Network API disponible en el puerto ${puerto}`));
}
