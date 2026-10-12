import type { AsistenciaConsolidada, Correccion, MarcaAsistencia } from "./tipos";
import { compararInstantes } from "./reloj";
export function consolidar(marcas: MarcaAsistencia[], correcciones: Correccion[] = []): AsistenciaConsolidada | null {
  const aceptadas = marcas.filter(marca => marca.estado === "aceptada").sort((a, b) => compararInstantes(a.recibidoEn ?? a.horaDispositivo, b.recibidoEn ?? b.horaDispositivo) || a.id.localeCompare(b.id));
  const cambios = correcciones.filter(correccion => correccion.estado === "aceptada").sort((a, b) => compararInstantes(a.recibidoEn, b.recibidoEn) || a.id.localeCompare(b.id));
  const ultima = cambios.at(-1);
  if (!aceptadas.length) {
    if (!ultima) return null;
    const primera = cambios.find(correccion => correccion.valorNuevo === "presente") ?? cambios[0];
    return {
      valor: ultima.valorNuevo, tipoRegistro: "manual", horaPrimerRegistro: primera.horaDispositivo,
      recibidoPrimerRegistro: primera.recibidoEn,
      registradores: [...new Set(cambios.map(correccion => correccion.corregidoPor))].sort(),
      conflicto: false, corregida: true,
    };
  }
  const presentes = aceptadas.filter(marca => marca.valor === "presente");
  const primera = presentes[0] ?? aceptadas[0];
  return {
    valor: ultima?.valorNuevo ?? (presentes.length ? "presente" : "ausente"),
    tipoRegistro: primera.tipoRegistro, horaPrimerRegistro: primera.horaDispositivo,
    recibidoPrimerRegistro: primera.recibidoEn ?? primera.horaDispositivo,
    registradores: [...new Set(aceptadas.map(marca => marca.registradoPor))].sort(),
    conflicto: presentes.some(presente => aceptadas.some(marca => marca.valor === "ausente" && marca.registradoPor !== presente.registradoPor)),
    corregida: Boolean(ultima),
  };
}
