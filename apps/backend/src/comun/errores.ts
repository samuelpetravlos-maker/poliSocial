export class ErrorHttp extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly detalles?: unknown
  ) {
    super(mensaje);
    this.name = 'ErrorHttp';
  }
}

export function esConflictoDuplicado(error: unknown): boolean {
  return (error as { code?: number }).code === 11000;
}
