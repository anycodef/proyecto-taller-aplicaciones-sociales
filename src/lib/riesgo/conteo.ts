import type { FaltaClasificada, SaldoInicial } from "./tipos";

export type ResultadoConteo = {
  conteo: number;
  faltasOrigen: FaltaClasificada[];
  pendientesJustificar: number;
};

export function contarFaltas(clasificadas: FaltaClasificada[], saldo?: SaldoInicial): ResultadoConteo {
  const domingos = clasificadas.filter((falta) => falta.origen === "domingo");
  const suman = domingos.filter(
    (falta) => falta.estado === "suma" && (!saldo || falta.fecha > saldo.fechaCorte),
  );

  const saldoContado = saldo && saldo.faltasNoJustificadas > 0 ? saldo.faltasNoJustificadas : 0;
  const faltasOrigen: FaltaClasificada[] = [...suman];

  if (saldo && saldoContado > 0) {
    faltasOrigen.push({
      catequizandoId: saldo.catequizandoId,
      fecha: saldo.fechaCorte,
      origen: "papel",
      estado: "suma",
      sesionIds: [],
      cantidad: saldoContado,
    });
  }

  const pendientesJustificar = domingos.filter(
    (falta) => falta.estado === "pendiente_justificar" || falta.estado === "en_revision",
  ).length;

  return {
    conteo: suman.length + saldoContado,
    faltasOrigen,
    pendientesJustificar,
  };
}
