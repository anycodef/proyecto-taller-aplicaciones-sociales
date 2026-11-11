import {
  clasificarFalta,
  contarFaltas,
  evaluarRiesgo,
  ordenarListaRiesgo,
  type FaltaClasificada,
  type FaltaParaClasificar,
} from "@/lib/riesgo";

const ahora = new Date("2026-11-10T12:00:00Z");

function falta(parcial: Partial<FaltaParaClasificar> = {}): FaltaParaClasificar {
  return {
    catequizandoId: "nino-1",
    fecha: "2026-11-01",
    origen: "domingo",
    sesionIds: ["sesion-1"],
    ...parcial,
  };
}

test("RF-701: una falta dentro del plazo queda pendiente y no suma", () => {
  const estado = clasificarFalta(falta({ venceEn: "2026-11-20T23:59:59Z" }), [], ahora);
  expect(estado).toBe("pendiente_justificar");
});

test("RF-701: una justificación aprobada marca la falta como justificada", () => {
  const estado = clasificarFalta(
    falta({ venceEn: "2026-11-20T23:59:59Z" }),
    [{ catequizandoId: "nino-1", fecha: "2026-11-01", estado: "aprobada" }],
    ahora,
  );
  expect(estado).toBe("justificada");
});

test("RF-701: una justificación pendiente al vencer espera revisión y no suma", () => {
  const estado = clasificarFalta(
    falta({ venceEn: "2026-11-05T23:59:59Z" }),
    [{ catequizandoId: "nino-1", fecha: "2026-11-01", estado: "pendiente" }],
    ahora,
  );
  expect(estado).toBe("en_revision");
});

test("RF-701: una falta vencida sin justificación suma", () => {
  const estado = clasificarFalta(falta({ venceEn: "2026-11-05T23:59:59Z" }), [], ahora);
  expect(estado).toBe("suma");
});

test("RF-701: una falta sin plazo conocido suma para no subestimar el riesgo", () => {
  const estado = clasificarFalta(falta(), [], ahora);
  expect(estado).toBe("suma");
});

test("RF-702: la jornada no cuenta para el riesgo y el domingo sí", () => {
  const clasificadas: FaltaClasificada[] = [
    { catequizandoId: "nino-1", fecha: "2026-11-01", origen: "domingo", estado: "suma", sesionIds: ["s1"] },
    { catequizandoId: "nino-1", fecha: "2026-11-02", origen: "jornada", estado: "suma", sesionIds: ["s2"] },
  ];

  const resultado = contarFaltas(clasificadas);

  expect(resultado.conteo).toBe(1);
  expect(resultado.faltasOrigen).toHaveLength(1);
  expect(resultado.faltasOrigen[0]?.origen).toBe("domingo");
});

test("RF-707: cero o una falta no generan riesgo", () => {
  expect(evaluarRiesgo({ catequizandoId: "nino-1", faltas: [] }, ahora).paso).toBe("sin_riesgo");
  expect(
    evaluarRiesgo({ catequizandoId: "nino-1", faltas: [falta()], fichaFirmada: true }, ahora).paso,
  ).toBe("sin_riesgo");
});

test("RF-707: dos faltas llevan a contacto", () => {
  const estado = evaluarRiesgo(
    { catequizandoId: "nino-1", faltas: [falta({ fecha: "2026-11-01" }), falta({ fecha: "2026-11-08" })] },
    ahora,
  );
  expect(estado.paso).toBe("contacto");
  expect(estado.sinFicha).toBe(true);
});

test("RF-707: tres faltas sin ficha llevan a citación", () => {
  const estado = evaluarRiesgo(
    {
      catequizandoId: "nino-1",
      faltas: [falta({ fecha: "2026-10-18" }), falta({ fecha: "2026-10-25" }), falta({ fecha: "2026-11-01" })],
    },
    ahora,
  );
  expect(estado.paso).toBe("citacion");
  expect(estado.sinFicha).toBe(true);
});

test("RF-707: tres faltas con ficha firmada llevan a seguimiento", () => {
  const estado = evaluarRiesgo(
    {
      catequizandoId: "nino-1",
      faltas: [falta({ fecha: "2026-10-18" }), falta({ fecha: "2026-10-25" }), falta({ fecha: "2026-11-01" })],
      fichaFirmada: true,
    },
    ahora,
  );
  expect(estado.paso).toBe("seguimiento");
  expect(estado.sinFicha).toBe(false);
});

test("RF-707: cuatro faltas llevan a alerta de retiro", () => {
  const estado = evaluarRiesgo(
    {
      catequizandoId: "nino-1",
      faltas: [
        falta({ fecha: "2026-10-11" }),
        falta({ fecha: "2026-10-18" }),
        falta({ fecha: "2026-10-25" }),
        falta({ fecha: "2026-11-01" }),
      ],
    },
    ahora,
  );
  expect(estado.paso).toBe("alerta_retiro");
});

test("RF-707: un retiro confirmado cierra el caso", () => {
  const estado = evaluarRiesgo(
    {
      catequizandoId: "nino-1",
      faltas: [falta(), falta({ fecha: "2026-11-08" })],
      retirado: true,
    },
    ahora,
  );
  expect(estado.paso).toBe("retirado");
});

test("RF-708: las faltas pendientes se informan sin sumar al conteo", () => {
  const estado = evaluarRiesgo(
    {
      catequizandoId: "nino-1",
      faltas: [falta({ venceEn: "2026-11-20T23:59:59Z" }), falta({ fecha: "2026-11-08" })],
    },
    ahora,
  );

  expect(estado.conteo).toBe(1);
  expect(estado.pendientesJustificar).toBe(1);
});

test("RF-708: el saldo de papel cuenta y no duplica faltas anteriores al corte", () => {
  const estado = evaluarRiesgo(
    {
      catequizandoId: "nino-1",
      faltas: [falta({ fecha: "2026-09-01" }), falta({ fecha: "2026-11-01" })],
      saldo: { catequizandoId: "nino-1", faltasNoJustificadas: 2, fechaCorte: "2026-10-31" },
    },
    ahora,
  );

  expect(estado.conteo).toBe(3);
  expect(estado.faltasOrigen.some((origen) => origen.origen === "papel")).toBe(true);
  expect(estado.paso).toBe("citacion");
});

test("RF-708: la lista ordena alerta, citación, contacto y deja fuera casos cerrados", () => {
  const lista = ordenarListaRiesgo([
    { catequizandoId: "nino-3", paso: "contacto", conteo: 2, sinFicha: true, pendientesJustificar: 0, faltasOrigen: [] },
    { catequizandoId: "nino-1", paso: "alerta_retiro", conteo: 4, sinFicha: true, pendientesJustificar: 0, faltasOrigen: [] },
    { catequizandoId: "nino-4", paso: "sin_riesgo", conteo: 1, sinFicha: true, pendientesJustificar: 0, faltasOrigen: [] },
    { catequizandoId: "nino-2", paso: "citacion", conteo: 3, sinFicha: true, pendientesJustificar: 0, faltasOrigen: [] },
    { catequizandoId: "nino-5", paso: "retirado", conteo: 5, sinFicha: true, pendientesJustificar: 0, faltasOrigen: [] },
  ]);

  expect(lista.map((estado) => estado.catequizandoId)).toEqual(["nino-1", "nino-2", "nino-3"]);
});
