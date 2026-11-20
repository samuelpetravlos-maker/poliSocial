import { Icono } from './iconos';

export function Avatar({
  nombre,
  color,
  tamano = 42,
  anillo = false,
  avatarUrl,
}: {
  nombre: string;
  color: string;
  tamano?: number;
  anillo?: boolean;
  avatarUrl?: string | null;
}) {
  const iniciales = nombre
    .replace(/^(Prof\.|Dra\.|Dr\.)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={`avatar${anillo ? ' avatar-anillo' : ''}`}
      style={{
        width: tamano,
        height: tamano,
        background: color,
        fontSize: Math.max(11, tamano * 0.36),
      }}
      aria-hidden="true"
    >
      {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : iniciales || 'PH'}
    </span>
  );
}

export function InsigniaVerificado({ tamano = 16 }: { tamano?: number }) {
  return (
    <span className="insignia-verificado" title="Verificado PJIC">
      <Icono nombre="verificado" tamano={tamano} />
    </span>
  );
}
