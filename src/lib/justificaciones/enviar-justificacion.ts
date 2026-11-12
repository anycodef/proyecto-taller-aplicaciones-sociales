import type { ClienteJustificaciones, DatosBinarios, LoteCreado } from "./cliente-justificaciones";
import type { Causa } from "./tipos";

export type FotoComprimida = { datos: DatosBinarios; bytes: number };

export type EntradaEnvio = {
  causa: Causa;
  fotos: readonly FotoComprimida[];
  ausencias: readonly { catequizandoId: string; sesionId: string }[];
};

export type DependenciasEnvio = {
  cliente: Pick<ClienteJustificaciones, "reservarEvidencia" | "subirArchivo" | "crearLote">;
  /** UUID generado en el cliente (regla del repo); `expo-crypto` en la app, un doble en las pruebas. */
  generarId: () => string;
  /** Libera los temporales de las fotos (RNF-404); se llama siempre, con éxito o con error. */
  limpiar?: () => Promise<void> | void;
};

export type MotivoFallo = "sin_red" | "ciclo_cerrado" | "no_justificable" | "limite" | "foto_invalida" | "sin_acceso" | "desconocido";
export class ErrorEnvio extends Error {
  constructor(readonly motivo: MotivoFallo, readonly mensaje: string) {
    super(motivo);
    this.name = "ErrorEnvio";
  }
}

const MENSAJES: Record<MotivoFallo, string> = {
  sin_red: "No se envió: no hay conexión con el servidor. Tus datos no se guardan; vuelve a intentarlo cuando tengas internet.",
  ciclo_cerrado: "No se envió: el ciclo ya está cerrado.",
  no_justificable: "No se envió: alguna ausencia ya no se puede justificar (venció el plazo o ya tiene una justificación).",
  limite: "No se envió: hiciste demasiados intentos seguidos. Espera unos minutos.",
  foto_invalida: "No se envió: la foto no es válida o pesa demasiado. Toma otra foto.",
  sin_acceso: "No se envió: tu sesión ya no sirve. Vuelve a abrir tu enlace.",
  desconocido: "No se envió por un problema del servidor. Inténtalo de nuevo.",
};

/** Traduce el error de red o HTTP a un motivo que la pantalla puede mostrar; sin estado numérico es un corte de red. */
export function clasificarError(error: unknown): ErrorEnvio {
  if (error instanceof ErrorEnvio) return error;
  const estado = error && typeof error === "object" && "estado" in error ? Number((error as { estado: unknown }).estado) : undefined;
  const codigo = error && typeof error === "object" && "codigo" in error ? String((error as { codigo: unknown }).codigo) : "";
  let motivo: MotivoFallo = "desconocido";
  if (estado === undefined) motivo = "sin_red";
  else if (estado === 401 || (estado === 403 && codigo !== "nino_ajeno")) motivo = "sin_acceso";
  else if (estado === 429) motivo = "limite";
  else if (codigo === "ciclo_no_abierto" || codigo === "ciclo_cerrado") motivo = "ciclo_cerrado";
  else if (estado === 400 || codigo === "evidencia_invalida" || codigo === "sin_evidencia") motivo = "foto_invalida";
  else if (estado === 422 || estado === 409 || codigo === "nino_ajeno") motivo = "no_justificable";
  return new ErrorEnvio(motivo, MENSAJES[motivo]);
}

/**
 * Reserva la evidencia, sube cada foto y crea el lote: una justificación por ausencia, una sola evidencia (RF-403).
 * No deja cola ni copia de la foto si algo falla (RNF-404): el error vuelve a la pantalla para que la familia reintente.
 */
export async function enviarJustificacion(deps: DependenciasEnvio, entrada: EntradaEnvio): Promise<LoteCreado> {
  try {
    const reserva = await deps.cliente.reservarEvidencia(entrada.fotos.map((foto) => ({ bytes: foto.bytes, contentType: "image/jpeg" as const })));
    for (const [indice, foto] of entrada.fotos.entries()) await deps.cliente.subirArchivo(reserva.evidenciaId, indice + 1, foto.datos);
    return await deps.cliente.crearLote({
      loteId: deps.generarId(),
      causa: entrada.causa,
      evidenciaId: reserva.evidenciaId,
      ausencias: entrada.ausencias.map((a) => ({ ...a, justificacionId: deps.generarId() })),
    });
  } catch (error) {
    throw clasificarError(error);
  } finally {
    await deps.limpiar?.();
  }
}
