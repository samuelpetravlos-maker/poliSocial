import { Icono, type NombreIcono } from '@/componentes_compartidos/comunes/iconos';

export type VistaSocial = 'inicio' | 'foros' | 'comunidades' | 'mensajes' | 'perfil' | 'resumen' | 'usuarios' | 'moderacion' | 'paginas' | 'catalogos' | 'auditoria';

export function BotonNavegacion({
  vista,
  actual,
  etiqueta,
  icono,
  onClick,
}: {
  vista: VistaSocial;
  actual: VistaSocial;
  etiqueta: string;
  icono: NombreIcono;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`nav-boton${vista === actual ? ' activo' : ''}`}
      onClick={onClick}
    >
      <Icono nombre={icono} tamano={22} relleno={vista === actual && vista === 'inicio'} />
      <span>{etiqueta}</span>
    </button>
  );
}
