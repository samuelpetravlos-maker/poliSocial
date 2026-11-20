import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

// Permite compilar la versión de producción mientras se usa localhost en desarrollo.
export default function configurar(fase) {
  return { distDir: fase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-produccion' };
}

