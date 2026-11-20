/** Origen web permitido por HTTP y Socket.IO. */
export function obtenerOrigenWebPermitido(): string {
  const configurado = process.env.ORIGEN_WEB?.trim();
  if (configurado) return configurado;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('En producción debes configurar ORIGEN_WEB con el origen público de la aplicación.');
  }
  return 'http://localhost:3000';
}
