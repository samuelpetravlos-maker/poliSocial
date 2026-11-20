import express, { RequestHandler } from 'express';
import { ErrorHttp } from '../../comun/errores';
import { LIMITE_ARCHIVO } from './servicios';

const leer = express.raw({ type: () => true, inflate: false, limit: LIMITE_ARCHIVO });
let cargas = 0;
export const recibirArchivo: RequestHandler = (peticion, respuesta, siguiente) => {
  if (cargas >= 3) return siguiente(new ErrorHttp(429, 'Hay varios archivos en proceso. Inténtalo de nuevo en unos segundos.'));
  cargas++;
  let liberado = false;
  const liberar = () => {
    if (!liberado) cargas--;
    liberado = true;
  };
  respuesta.once('finish', liberar);
  respuesta.once('close', liberar);
  leer(peticion, respuesta, (error?: {status?: number}) => {
    if (error?.status === 413) return siguiente(new ErrorHttp(413, 'El archivo supera los 64 MB.'));
    if (error) return siguiente(new ErrorHttp(400, 'No se pudo leer el archivo enviado.'));
    siguiente();
  });
};
