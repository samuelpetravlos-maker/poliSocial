import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

export default function configurar(fase) {
  const api = process.env.API_INTERNA;
  return {
    distDir: fase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-produccion',
    async rewrites() {
      if (!api) return [];
      return ['/api/:ruta*', '/archivos/:ruta*', '/socket.io/:ruta*'].map(source => ({
        source,
        destination: api + source,
      }));
    },
  };
}
