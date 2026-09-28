export class ErrorDeValidacion extends Error {
  readonly code = "VALIDACION";
}

export class NoEncontrado extends Error {
  readonly code = "NO_ENCONTRADO";
}
