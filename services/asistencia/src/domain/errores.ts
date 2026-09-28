/** Errores de dominio. La capa HTTP los traduce a 400 / 404; el dominio no sabe de HTTP. */

export class ErrorDeValidacion extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorDeValidacion";
  }
}

export class ErrorNoEncontrado extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorNoEncontrado";
  }
}
