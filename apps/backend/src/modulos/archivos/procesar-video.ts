import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ffmpegPath, ffprobePath } from 'ffmpeg-ffprobe-static';
import { ErrorHttp } from '../../comun/errores';

const ejecutar = promisify(execFile);
const limiteBytes = 64 * 1024 * 1024;
const ejecutable = () => process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg';
const rutaSonda = () => process.env.FFPROBE_PATH || ffprobePath || 'ffprobe';
type Pista = { codec_type: string; codec_name: string; width?: number; height?: number; duration?: string; disposition?: { attached_pic?: number } };

function formatoVideo(datos: Buffer): string {
  if (datos.toString('ascii', 4, 8) === 'ftyp' || ['moov', 'wide', 'mdat'].includes(datos.toString('ascii', 4, 8))) return 'mov';
  if (datos.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'matroska';
  if (datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'AVI ') return 'avi';
  if (datos.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (datos[0] === 0 && datos[1] === 0 && datos[2] === 1 && [0xba, 0xb3].includes(datos[3])) return 'mpeg';
  if (datos[0] === 0x47 && datos[188] === 0x47) return 'mpegts';
  throw new ErrorHttp(415, 'No se reconoce el contenedor del video.');
}

async function analizar(ruta: string, formato: string) {
  const { stdout } = await ejecutar(rutaSonda(), ['-v','error','-protocol_whitelist','file','-f',formato,'-show_streams','-show_format','-of','json',ruta], { timeout: 15000, maxBuffer: 512 * 1024, windowsHide: true });
  const informacion = JSON.parse(stdout) as { streams: Pista[]; format: { duration?: string } };
  const video = informacion.streams.find(p => p.codec_type === 'video' && !p.disposition?.attached_pic);
  const duracion = Math.max(...[informacion.format.duration, ...informacion.streams.map(p => p.duration)].map(Number).filter(Number.isFinite));
  if (!video || !video.width || !video.height || video.width * video.height > 34_000_000) throw new ErrorHttp(415, 'El archivo no contiene una pista de video compatible.');
  return { duracion, video, pistas: informacion.streams };
}

export async function comprimirVideo(datos: Buffer, esEstado: boolean) {
  const formato = formatoVideo(datos);
  const carpeta = await mkdtemp(path.join(tmpdir(), 'poli-video-'));
  try {
    const entrada = path.join(carpeta,'entrada');
    const salida = path.join(carpeta,'salida.mp4');
    await writeFile(entrada, datos);
    const fuente = await analizar(entrada, formato);
    const maximo = esEstado ? 120 : 1800;
    // WebM grabado en el navegador a veces no incluye duración. Se mide de nuevo tras normalizarlo.
    const validarDuracion = (duracion: number) => {
      if (duracion > maximo) throw new ErrorHttp(400, esEstado ? 'El video de un estado puede durar hasta 2 minutos.' : 'El video puede durar hasta 30 minutos.');
    };
    validarDuracion(fuente.duracion);
    const opciones = ['-nostdin','-v','error','-protocol_whitelist','file','-f',formato,'-threads','2','-i',entrada,
      '-map','0:V:0','-map','0:a:0?','-map_metadata','-1','-map_chapters','-1','-t',String(maximo + 1),
      '-vf',"scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
      '-c:v','libx264','-threads','2','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-fs',String(limiteBytes + 512 * 1024),'-movflags','+faststart',salida];
    await ejecutar(ejecutable(), opciones, { timeout: 180000, maxBuffer: 256 * 1024, windowsHide: true });
    const final = await analizar(salida, 'mov');
    validarDuracion(final.duracion);
    if (!Number.isFinite(final.duracion) || final.duracion <= 0) throw new ErrorHttp(415, 'No se pudo determinar la duración real del video.');
    if ((await stat(salida)).size > limiteBytes) throw new ErrorHttp(413, 'El video procesado supera los 64 MB.');
    return { contenido: await readFile(salida), mime: 'video/mp4', extension: '.mp4', duracion: final.duracion };
  } catch (error) {
    if (error instanceof ErrorHttp) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ErrorHttp(503, 'El procesador de video no está instalado en el servidor.');
    throw new ErrorHttp(422, 'No se pudo procesar el video. Comprueba que el archivo se reproduce correctamente.');
  } finally { await rm(carpeta, { recursive: true, force: true }); }
}

export async function convertirImagenWindows(datos: Buffer, extension: string) {
  const esBmp = extension === 'bmp' && datos.toString('ascii', 0, 2) === 'BM';
  const esIcono = extension === 'ico' && datos.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]));
  if (!esBmp && !esIcono) throw new ErrorHttp(415, 'La firma de la imagen no es válida.');
  const carpeta = await mkdtemp(path.join(tmpdir(), 'poli-imagen-'));
  try {
    const entrada = path.join(carpeta, 'imagen.' + extension);
    const salida = path.join(carpeta, 'resultado.png');
    await writeFile(entrada, datos);
    await ejecutar(ejecutable(), ['-nostdin','-v','error','-max_alloc','192000000','-protocol_whitelist','file','-f',esBmp ? 'image2' : 'ico','-i',entrada,'-frames:v','1','-vf',"scale='min(iw,2400)':-1",salida], { windowsHide: true, timeout: 15000 });
    return await readFile(salida);
  } finally { await rm(carpeta, { recursive: true, force: true }); }
}
