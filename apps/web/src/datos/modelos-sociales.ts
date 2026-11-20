export type Canal = 'GENERAL' | 'ACADEMICO' | 'PROYECTOS' | 'AVISOS' | 'MERCADO';
export type Sede = 'URABA' | 'MEDELLIN' | 'RIONEGRO' | (string & {});

export interface AutorSocial {
  id: string;
  nombre: string;
  usuario: string;
  sede: Sede;
  etiquetaSede?: string;
  programa: string;
  verificado: boolean;
  color: string;
  avatarUrl?: string | null;
  tipoCuenta?: 'STUDENT' | 'TEACHER' | 'PAGE';
  etiquetaPerfil?: string;
  rol?: 'estudiante' | 'docente' | 'moderador';
}

export interface ComentarioSocial {
  id: string;
  autor: AutorSocial;
  texto: string;
  fecha: string;
  solucion?: boolean;
}

export type FormatoPublicacion = 'NOTICIA' | 'ENCUESTA' | 'PREGUNTA' | 'FORO' | 'EVENTO';

export const NOMBRES_FORMATO: Record<FormatoPublicacion, string> = {
  NOTICIA: 'Publicación', ENCUESTA: 'Encuesta', PREGUNTA: 'Pregunta',
  FORO: 'Foro de debate', EVENTO: 'Evento',
};

export interface ResultadoEncuesta {
  totales: Record<number, number>;
  miOpcion: number | null;
}

export interface PublicacionSocial {
  formato?: FormatoPublicacion;
  ubicacion?: string;
  fechaEvento?: string;
  opcionesEncuesta?: string[];
  resultadoEncuesta?: ResultadoEncuesta;
  id: string;
  autor: AutorSocial;
  canal: Canal;
  titulo?: string;
  contenido: string;
  etiquetas: string[];
  likes: number;
  comentarios: ComentarioSocial[];
  comentariosCount?: number;
  reaccionado: boolean;
  reaccionTipo?: 'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED' | null;
  dislikes?: number;
  archivos?: Array<{ url: string; nombre: string; mime: string }>;
  paginaId?: string;
  reaccionesPorTipo?: Partial<Record<'LIKE' | 'DISLIKE' | 'LOVE' | 'FUN' | 'AMAZED', number>>;
  fecha: string;
  fijado?: boolean;
  resuelto?: boolean;
  media?: { titulo: string; detalle: string; tono: 'verde' | 'dorado' | 'azul' };
  mercado?: { precio: string; estado: 'Disponible' | 'Vendido' };
}

export interface MensajeSocial {
  id: string;
  autorId: string;
  texto: string;
  hora: string;
  propio?: boolean;
  adjunto?: string;
  autorNombre?: string;
}

export interface ConversacionSocial {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'directo' | 'grupo';
  iniciales: string;
  color: string;
  ultimo: string;
  hora: string;
  noLeidos: number;
  mensajes: MensajeSocial[];
}

export const NOMBRE_CANAL: Record<Canal, string> = {
  GENERAL: 'Muro general',
  ACADEMICO: 'Académico y Código',
  PROYECTOS: 'Proyectos y Semilleros',
  AVISOS: 'Avisos Poli',
  MERCADO: 'Mercado Poli',
};

export const NOMBRE_SEDE: Record<string, string> = {
  URABA: 'Urabá',
  MEDELLIN: 'Medellín',
  RIONEGRO: 'Rionegro',
};

export function nombreDeSede(sede: string): string {
  return NOMBRE_SEDE[sede] ?? sede.replaceAll('_', ' ').toLocaleLowerCase('es');
}
