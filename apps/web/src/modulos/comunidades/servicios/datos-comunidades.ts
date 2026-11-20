import { Sede } from '@/servicios/api-cliente';
import { NombreIcono } from '@/componentes_compartidos/comunes/iconos';

export type TipoAccesoComunidad = 'LIBRE' | 'APROBACION' | 'INVITACION';
export type CategoriaComunidad =
  | 'ACADEMICO'
  | 'SEMILLERO'
  | 'TECNOLOGIA'
  | 'EMPRENDIMIENTO'
  | 'DEPORTES'
  | 'CULTURA';

export interface Comunidad {
  id: string;
  nombre: string;
  descripcion: string;
  sede: Sede | 'GLOBAL';
  categoria: CategoriaComunidad;
  tipoAcceso: TipoAccesoComunidad;
  miembrosCount: number;
  creadorId: string;
  creadorNombre: string;
  color: string;
  esMiembro: boolean;
  nombreSede?: string;
  invitacionPendiente?: boolean;
  solicitudPendiente?: boolean;
  solicitudesCount?: number;
  chatIdAsociado?: string;
  reglas?: string[];
  creadoEn: string;
}

export interface InformacionAcceso {
  tipo: TipoAccesoComunidad;
  titulo: string;
  etiquetaCorta: string;
  descripcion: string;
  icono: NombreIcono;
  clase: string;
}

export const INFORMACION_ACCESO: Record<TipoAccesoComunidad, InformacionAcceso> = {
  LIBRE: {
    tipo: 'LIBRE',
    titulo: 'Acceso Libre',
    etiquetaCorta: 'Libre',
    descripcion: 'Cualquier estudiante del Poli puede unirse al instante con un solo clic.',
    icono: 'candadoAbierto',
    clase: 'acceso-libre',
  },
  APROBACION: {
    tipo: 'APROBACION',
    titulo: 'Por Aprobación',
    etiquetaCorta: 'Aprobación',
    descripcion: 'Requiere solicitud previa; un moderador o fundador del grupo revisa el perfil.',
    icono: 'escudo',
    clase: 'acceso-aprobacion',
  },
  INVITACION: {
    tipo: 'INVITACION',
    titulo: 'Por Invitación',
    etiquetaCorta: 'Privado',
    descripcion: 'Acceso privado mediante código institucional o invitación directa de un miembro.',
    icono: 'candado',
    clase: 'acceso-invitacion',
  },
};

export const NOMBRES_CATEGORIAS: Record<CategoriaComunidad, string> = {
  ACADEMICO: 'Académico y Tutorías',
  SEMILLERO: 'Semilleros e Investigación',
  TECNOLOGIA: 'Tecnología y Código',
  EMPRENDIMIENTO: 'Mercado y Emprendimiento',
  DEPORTES: 'Deportes y Torneos',
  CULTURA: 'Cultura y Bienestar',
};
