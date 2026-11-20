import type { Metadata, Viewport } from 'next';
import './estilos.css';
import { ProveedorAutenticacion } from '@/modulos/autenticacion/controladores/contexto';

export const metadata: Metadata = {
  title: 'Poli Social Network · Comunidad PJIC',
  description:
    'Red social universitaria del Politécnico Colombiano Jaime Isaza Cadavid: muro, foros académicos y mensajería en tiempo real.',
};

export const viewport: Viewport = {
  themeColor: '#1b5e20',
  width: 'device-width',
  initialScale: 1,
};

export default function DisposicionPrincipal({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <ProveedorAutenticacion>{children}</ProveedorAutenticacion>
      </body>
    </html>
  );
}
