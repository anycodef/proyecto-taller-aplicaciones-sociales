import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { puedePasarLista } from "./autorizacion";
import type { ListaAsistencia, MarcaAsistencia, Sesion, ValorAsistencia } from "./tipos";
export type BorradorLista = Record<string, ValorAsistencia>;
export const abrirLista = (ninosActivos: { id: string }[]): BorradorLista => Object.fromEntries(ninosActivos.map(nino => [nino.id, "presente"]));
export function alternar(borrador: BorradorLista, ninoId: string): BorradorLista {
  if (!(ninoId in borrador)) throw new Error("Niño ajeno a la lista");
  return { ...borrador, [ninoId]: borrador[ninoId] === "presente" ? "ausente" : "presente" };
}
export function confirmarLista(entrada: { borrador: BorradorLista; cuenta: ContextoAcceso; sesion: Sesion; grupoId: string; id: string; generarId: () => string; abiertaEn: string; hora: string; desfaseRelojMs: number }): { lista: ListaAsistencia; marcas: MarcaAsistencia[] } {
  if (!puedePasarLista(entrada.cuenta) || !entrada.cuenta.dispositivoId || entrada.sesion.cancelada || entrada.sesion.tipo === "misa") throw new Error("Lista no autorizada");
  const filas = Object.entries(entrada.borrador);
  const lista: ListaAsistencia = {
    id: entrada.id, cicloId: entrada.sesion.cicloId, sesionId: entrada.sesion.id, grupoId: entrada.grupoId,
    confirmadaPor: entrada.cuenta.cuentaId, credencialId: entrada.cuenta.credencialId, dispositivoId: entrada.cuenta.dispositivoId,
    abiertaEn: entrada.abiertaEn, confirmadaEn: entrada.hora, desfaseRelojMs: entrada.desfaseRelojMs,
    totalPresentes: filas.filter(([, valor]) => valor === "presente").length, totalAusentes: filas.filter(([, valor]) => valor === "ausente").length,
  };
  return { lista, marcas: filas.map(([catequizandoId, valor]) => ({
    id: entrada.generarId(), cicloId: lista.cicloId, sesionId: lista.sesionId, catequizandoId,
    valor, tipoRegistro: "lista", listaId: lista.id, registradoPor: lista.confirmadaPor,
    credencialId: lista.credencialId, dispositivoId: lista.dispositivoId, horaDispositivo: lista.confirmadaEn,
    desfaseRelojMs: lista.desfaseRelojMs, estado: "pendiente",
  })) };
}
