/** Error de negocio: se traduce a una respuesta HTTP con codigo y mensaje. */
export class ErrorApp extends Error {
  constructor(
    public readonly estado: number,
    message: string,
    public readonly codigo: string = 'ERROR',
    public readonly detalle?: unknown,
  ) {
    super(message);
    this.name = 'ErrorApp';
  }
}

export const noEncontrado = (que: string) => new ErrorApp(404, `${que} no encontrado`, 'NO_ENCONTRADO');
export const conflicto = (msg: string) => new ErrorApp(409, msg, 'CONFLICTO');
export const invalido = (msg: string, detalle?: unknown) => new ErrorApp(400, msg, 'INVALIDO', detalle);
export const noAutorizado = (msg = 'No autenticado') => new ErrorApp(401, msg, 'NO_AUTORIZADO');
export const prohibido = (msg = 'No tienes permiso para esta acción') =>
  new ErrorApp(403, msg, 'PROHIBIDO');
