import type { ReactNode } from 'react';

export type NombreIcono =
  | 'inicio'
  | 'foros'
  | 'mensajes'
  | 'perfil'
  | 'crear'
  | 'buscar'
  | 'campana'
  | 'corazon'
  | 'comentario'
  | 'compartir'
  | 'verificado'
  | 'fijado'
  | 'sol'
  | 'luna'
  | 'enviar'
  | 'atras'
  | 'graduacion'
  | 'ajustes'
  | 'guardar'
  | 'enlace'
  | 'cerrar'
  | 'mas'
  | 'ubicacion'
  | 'maletin'
  | 'codigo'
  | 'personas'
  | 'candado'
  | 'correo'
  | 'salir'
  | 'usuario'
  | 'escudo'
  | 'candadoAbierto'
  | 'check';

const TRAZOS: Record<NombreIcono, ReactNode> = {
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  foros: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  mensajes: (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M8 11h8M8 8h5" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  crear: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  campana: (
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  corazon: <path d="M12 20s-7.5-4.4-7.5-9.3A4.2 4.2 0 0 1 12 7.5a4.2 4.2 0 0 1 7.5 3.2C19.5 15.6 12 20 12 20Z" />,
  comentario: <path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z" />,
  compartir: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </>
  ),
  verificado: (
    <>
      <path d="m12 2.5 2.4 1.8 3-.2 1 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.9-3-.2L12 21.5l-2.4-1.8-3 .2-1-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8 1-2.9 3 .2Z" />
      <path d="m8.7 12.2 2.2 2.2 4.4-4.6" />
    </>
  ),
  fijado: <path d="M9 3h6l-1 6 3 3H7l3-3-1-6ZM12 12v9" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  luna: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
  enviar: (
    <>
      <path d="m3 11 18-8-8 18-2.5-7.5L3 11Z" />
      <path d="M10.5 13.5 21 3" />
    </>
  ),
  atras: <path d="M19 12H5M11 6l-6 6 6 6" />,
  graduacion: (
    <>
      <path d="m2.5 8.5 9.5-5 9.5 5-9.5 5-9.5-5Z" />
      <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5M21.5 8.5V14" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  guardar: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  enlace: (
    <>
      <path d="M10 13a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4L10.8 5.8" />
      <path d="M14 11a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1.3-1.3" />
    </>
  ),
  cerrar: <path d="m6 6 12 12M18 6 6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  ubicacion: (
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  maletin: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5h6v2M3 12h18" />
    </>
  ),
  codigo: (
    <>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
      <path d="m13.5 5-3 14" />
    </>
  ),
  personas: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.7 14.5A5.2 5.2 0 0 1 21.2 20" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  correo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  salir: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </>
  ),
  candadoAbierto: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V6a4 4 0 0 1 7.8-1.2" />
    </>
  ),
  check: (
    <>
      <polyline points="20 6 9 17 4 12" />
    </>
  ),
};

export function Icono({
  nombre,
  tamano = 20,
  className,
  relleno = false,
}: {
  nombre: NombreIcono;
  tamano?: number;
  className?: string;
  relleno?: boolean;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
