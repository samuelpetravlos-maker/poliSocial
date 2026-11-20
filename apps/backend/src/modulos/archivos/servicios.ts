import sharp from 'sharp';
import { ErrorHttp } from '../../comun/errores';
import { AlmacenamientoLocal } from '../../infraestructura/archivos/almacenamiento-local';
import { comprimirVideo, convertirImagenWindows } from './procesar-video';

const imagenes: Record<string, string[]> = {
  jpeg: ['jpg','jpeg','jfif'], png: ['png','apng'], webp: ['webp'], gif: ['gif'],
  tiff: ['tif','tiff'], avif: ['avif'], heif: ['heif','heic','hif'], svg: ['svg'], bmp: ['bmp'], ico: ['ico']
};
const videos: Record<string, string[]> = {
  mp4: ['mp4','m4v','3gp','3g2'], quicktime: ['mov'], webm: ['webm'], matroska: ['mkv'], avi: ['avi'], ogg: ['ogv'], mpeg: ['mpg','mpeg','mts','m2ts','ts']
};
const tiposImagen = new Set([...Object.keys(imagenes).map(t => 'image/' + t), 'image/heic','image/pjpeg','image/x-icon','image/vnd.microsoft.icon','image/x-ms-bmp','image/apng','image/heic-sequence','image/heif-sequence']);
const tiposVideo = new Set([...Object.keys(videos).map(t => 'video/' + t), 'video/x-matroska','video/x-msvideo','video/3gpp','video/3gpp2','video/mp2t','video/x-m4v']);
export const LIMITE_ARCHIVO = 64 * 1024 * 1024;
const limitePixeles = 48_000_000;
const peligroso = /\.(?:apk|exe|com|msi|jar|scr|dll|bat|cmd|ps1|js|html?|hta|vbs|lnk)(?:\.|$)/i;
type UsoArchivo = 'publicacion' | 'estado';
type Resultado = { contenido: Buffer; mime: string; extension: string; duracion: number | null };

function obtenerNombre(valor: unknown) {
  if (typeof valor !== 'string') return 'archivo';
  let nombre: string;
  try { nombre = decodeURIComponent(valor); } catch { nombre = valor; }
  return nombre.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,255) || 'archivo';
}

async function convertirImagen(datos: Buffer, extension: string): Promise<Resultado> {
  try {
    if (extension === 'bmp' || extension === 'ico') datos = await convertirImagenWindows(datos, extension);
    let imagen = sharp(datos, { animated: true, limitInputPixels: limitePixeles, failOn: 'error' });
    let meta = await imagen.metadata();
    if (meta.format === 'heif' && meta.compression === 'hevc') {
      if (!meta.width || !meta.height || meta.width * meta.height > limitePixeles) throw new Error('Dimensiones no válidas');
      const convertir = require('heic-convert') as (o: {buffer: Buffer; format: 'JPEG'; quality: number}) => Promise<ArrayBuffer>;
      imagen = sharp(Buffer.from(await convertir({ buffer: datos, format: 'JPEG', quality: 0.95 })), { limitInputPixels: limitePixeles });
      meta = await imagen.metadata();
    }
    if (!meta.width || !meta.height || meta.width * meta.height > limitePixeles) throw new Error('Dimensiones no válidas');
    // Rasterizar los vectores elimina el contenido activo del archivo entregado al navegador.
    const resultado = await imagen.autoOrient().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, effort: 3 }).toBuffer();
    return { contenido: resultado, extension: '.webp', mime: 'image/webp', duracion: null };
  } catch (error) {
    if (error instanceof ErrorHttp) throw error;
    throw new ErrorHttp(415, 'La imagen no se puede decodificar o supera el límite de 48 megapíxeles.');
  }
}

export async function prepararArchivo(tipo: string, contenido: Buffer, nombreOriginal: unknown, uso: UsoArchivo = 'publicacion') {
  const nombre = obtenerNombre(nombreOriginal);
  const extension = nombre.toLowerCase().split('.').pop() ?? '';
  if (peligroso.test(nombre)) throw new ErrorHttp(415, 'Los archivos ejecutables no están permitidos.');
  if (!contenido.length) throw new ErrorHttp(400, 'El archivo está vacío.');
  if (contenido.length > LIMITE_ARCHIVO) throw new ErrorHttp(413, 'El archivo supera los 64 MB.');
  const generico = !tipo || tipo === 'application/octet-stream';
  let resultado: Resultado;
  if (tiposImagen.has(tipo) || tipo === 'image/svg+xml' || (generico && Object.values(imagenes).flat().includes(extension))) {
    resultado = await convertirImagen(contenido, extension);
  } else if (tiposVideo.has(tipo) || (generico && Object.values(videos).flat().includes(extension))) {
    resultado = await comprimirVideo(contenido, uso === 'estado');
  } else if (uso === 'publicacion' && (tipo === 'application/pdf' || (generico && extension === 'pdf'))) {
    if (!contenido.subarray(0,5).equals(Buffer.from('%PDF-')) || !contenido.subarray(-2048).includes('%%EOF')) throw new ErrorHttp(415, 'El documento no es un PDF válido.');
    resultado = { contenido, mime: 'application/pdf', extension: '.pdf', duracion: null };
  } else {
    throw new ErrorHttp(415, uso === 'estado' ? 'Elige una foto o un video para tu estado.' : 'Elige una imagen, un video o un documento PDF.');
  }
  return { ...resultado, nombreOriginal: nombre };
}

export class ArchivosServicio {
  constructor(private readonly almacenamiento: AlmacenamientoLocal) {}
  async guardar(tipo: string, contenido: Buffer, nombreOriginal: unknown) {
    const resultado = await prepararArchivo(tipo, contenido, nombreOriginal);
    const archivo = await this.almacenamiento.guardar(resultado.contenido, resultado.extension);
    return { url: archivo.url, nombreOriginal: resultado.nombreOriginal, mime: resultado.mime, tamano: archivo.tamano };
  }
}
