export type FilaSincronizada = { id: string } & Record<string, string | number | boolean | null>;
export type CambiosTabla = { created: FilaSincronizada[]; updated: FilaSincronizada[]; deleted: string[] };
export type CambiosPorTabla = Record<string, CambiosTabla>;
export interface RespuestaPull { changes: CambiosPorTabla; timestamp: number; experimentalStrategy?: "replacement"; huellaAlcance: string }
export interface ResumenPush { aceptados: number; rechazados: number; descartadosCierre: number }
export const cambiosVacios = (): CambiosTabla => ({ created: [], updated: [], deleted: [] });
export interface EnvoltorioEspanol {
  cambios: Record<string, { creados: FilaSincronizada[]; actualizados: FilaSincronizada[]; eliminados: string[] }>;
  marcaTiempo: number; estrategiaExperimental?: "replacement"; huellaAlcance: string;
}
export function desdeEnvoltorioEspanol(pull: EnvoltorioEspanol): RespuestaPull {
  return { changes: Object.fromEntries(Object.entries(pull.cambios).map(([tabla, filas]) => [tabla, { created: filas.creados, updated: filas.actualizados, deleted: filas.eliminados }])), timestamp: pull.marcaTiempo, experimentalStrategy: pull.estrategiaExperimental, huellaAlcance: pull.huellaAlcance };
}
// Watermelon conserva las columnas del servidor; no deben volver como mutaciones del cliente.
export function prepararPush(changes: CambiosPorTabla): { changes: CambiosPorTabla } {
  const columnasServidor = new Set(["estado", "motivo_rechazo", "recibido_en", "actualizado_en", "eliminado_en", "_status", "_changed"]);
  const copiar = (fila: FilaSincronizada): FilaSincronizada => Object.fromEntries(Object.entries(fila).filter(([columna]) => !columnasServidor.has(columna))) as FilaSincronizada;
  return { changes: Object.fromEntries(Object.entries(changes).map(([tabla, filas]) => [tabla, { created: filas.created.map(copiar), updated: filas.updated.map(copiar), deleted: filas.deleted }])) };
}
export function aEnvoltorioEspanol(pull: RespuestaPull) {
  return { cambios: Object.fromEntries(Object.entries(pull.changes).map(([tabla, filas]) => [tabla, { creados: filas.created, actualizados: filas.updated, eliminados: filas.deleted }])), marcaTiempo: pull.timestamp, estrategiaExperimental: pull.experimentalStrategy, huellaAlcance: pull.huellaAlcance };
}
