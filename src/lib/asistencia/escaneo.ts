import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { puedeEscanear, puedeVerNombreAlEscanear } from "./autorizacion";
import { resolverCarne } from "./carne";
import { dentroDeVentana, horaEfectiva } from "./reloj";
import { ventanaDe } from "./sesiones";
import type { MarcaAsistencia, NinoNomina, Sesion } from "./tipos";
export function procesarEscaneo(entrada: {
  cuenta: ContextoAcceso; sesion: Sesion; codigo: string; nomina: NinoNomina[];
  conConexion: boolean; existentes: MarcaAsistencia[]; id: string;
  horaDispositivo: string; desfaseRelojMs: number;
}): { resultado: "registrado" | "ya_registrado" | "pendiente_validacion" | "rechazado" | "fuera_de_ventana"; mostrarNombre: boolean; marca?: MarcaAsistencia } {
  const { cuenta, sesion } = entrada;
  if (!puedeEscanear(cuenta) || !cuenta.dispositivoId || sesion.cancelada || sesion.tipo === "catequesis") return { resultado: "rechazado", mostrarNombre: false };
  if (!dentroDeVentana(horaEfectiva(entrada.horaDispositivo, entrada.desfaseRelojMs), ventanaDe(sesion))) return { resultado: "fuera_de_ventana", mostrarNombre: false };
  const carne = resolverCarne(entrada.codigo, entrada.nomina);
  if (entrada.conConexion && carne.estado !== "valido") return { resultado: "rechazado", mostrarNombre: false };
  const mostrarNombre = carne.estado === "valido" && Boolean(carne.nino && puedeVerNombreAlEscanear(cuenta, carne.nino));
  if (entrada.existentes.some(marca => marca.sesionId === sesion.id && marca.codigoLeido === entrada.codigo && marca.estado !== "rechazada")) return { resultado: "ya_registrado", mostrarNombre };
  return {
    resultado: carne.estado === "valido" ? "registrado" : "pendiente_validacion", mostrarNombre,
    marca: { id: entrada.id, cicloId: sesion.cicloId, sesionId: sesion.id,
      catequizandoId: carne.estado === "valido" ? carne.nino!.id : null, codigoLeido: entrada.codigo,
      valor: "presente", tipoRegistro: "escaneo", registradoPor: cuenta.cuentaId,
      credencialId: cuenta.credencialId, dispositivoId: cuenta.dispositivoId,
      horaDispositivo: entrada.horaDispositivo, desfaseRelojMs: entrada.desfaseRelojMs, estado: "pendiente" },
  };
}
