import type { EstadoDocumento, TipoDocumento } from "./modelo";
export const TIPOS_DOCUMENTO = ["documento_identidad", "partida_nacimiento", "partida_bautismo", "boleta_pago", "ficha_compromiso"] as const;
export const estadosIniciales = (bautizado: boolean): { tipo: TipoDocumento; estado: EstadoDocumento }[] => TIPOS_DOCUMENTO.map(tipo => ({ tipo, estado: tipo === "partida_bautismo" && !bautizado ? "no_aplica" : "pendiente" }));
export const cuentaComoPendiente = (estado: EstadoDocumento): boolean => estado === "pendiente" || estado === "invalido";
export function aplicarCambioDocumento(actual: EstadoDocumento, accion: { estado: EstadoDocumento; motivo?: string }): { valido: boolean; codigo?: string } {
  if ((accion.estado === "invalido" || (actual === "pendiente" && accion.estado === "no_aplica")) && !accion.motivo?.trim()) return { valido: false, codigo: "motivo_obligatorio" };
  const transiciones: Record<EstadoDocumento, EstadoDocumento[]> = { pendiente: ["entregado", "no_aplica"], entregado: ["invalido"], invalido: ["entregado"], no_aplica: ["pendiente"] };
  return transiciones[actual].includes(accion.estado) || actual === accion.estado ? { valido: true } : { valido: false, codigo: "transicion_documental_invalida" };
}
