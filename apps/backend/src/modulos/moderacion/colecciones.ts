import { ObjectId } from 'mongodb';

export const TIPOS_OBJETIVO_REPORTE = ['POST', 'COMMENT', 'USER', 'PAGE', 'MESSAGE'] as const;
export const MOTIVOS_REPORTE = ['SPAM', 'ACOSO', 'CONTENIDO_INAPROPIADO', 'FRAUDE', 'SUPLANTACION', 'OTRO'] as const;
export const ESTADOS_REPORTE = ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;

export type TipoObjetivoReporte = (typeof TIPOS_OBJETIVO_REPORTE)[number];
export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number];
export type EstadoReporte = (typeof ESTADOS_REPORTE)[number];

export interface ReporteColeccion {
  _id?: ObjectId;
  reporterId: string;
  reporterName: string;
  targetType: TipoObjetivoReporte;
  targetId: string;
  reason: MotivoReporte;
  details: string;
  status: EstadoReporte;
  assignedTo: string | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
}
