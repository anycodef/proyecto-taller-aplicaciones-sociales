import {
  alternarMarca,
  aplicarResultadoPush,
  crearMarca,
  guardarMarca,
  idListaAsistencia,
  idMarcaAsistencia,
  PENDIENTES_VACIOS,
  prepararLote,
  resumenPendientes,
  type DatosMarca,
  type Pendientes,
} from "@/lib/asistencia/pendientes";

const sesionId = "11111111-1111-4111-8111-111111111111";
const ninoId = "22222222-2222-4222-8222-222222222222";

function datosMarca(extra: Partial<DatosMarca> = {}): DatosMarca {
  return {
    sesionId,
    cicloId: "33333333-3333-4333-8333-333333333333",
    catequizandoId: ninoId,
    valor: "presente",
    tipoRegistro: "lista",
    listaId: null,
    registradoPor: "44444444-4444-4444-8444-444444444444",
    cuentaId: "44444444-4444-4444-8444-444444444444",
    credencialId: "55555555-5555-4555-8555-555555555555",
    dispositivoId: "66666666-6666-4666-8666-666666666666",
    horaDispositivo: "2026-10-19T09:00:00.000Z",
    desfaseRelojMs: 0,
    ...extra,
  };
}

test("RF-307: el id de la marca es determinista y el reintento no duplica", () => {
  const primera = idMarcaAsistencia(sesionId, ninoId, "lista");
  const segunda = idMarcaAsistencia(sesionId, ninoId, "lista");
  const otraSesion = idMarcaAsistencia("otra-sesion", ninoId, "lista");
  const otroTipo = idMarcaAsistencia(sesionId, ninoId, "manual");

  expect(primera).toBe(segunda);
  expect(primera).not.toBe(otraSesion);
  expect(primera).not.toBe(otroTipo);

  const marca = crearMarca(datosMarca());
  expect(marca.id).toBe(primera);

  const guardada = guardarMarca(PENDIENTES_VACIOS, marca);
  const repetida = guardarMarca(guardada, crearMarca(datosMarca()));

  expect(repetida.marcas).toHaveLength(1);
  expect(repetida.marcas[0].fila.id).toBe(primera);
});

test("RF-306: marcar alterna presente y ausente sobre la misma marca", () => {
  const pendientes = guardarMarca(PENDIENTES_VACIOS, crearMarca(datosMarca({ valor: "presente" })));
  const alternada = alternarMarca(pendientes, pendientes.marcas[0].id, "ausente");

  expect(alternada.marcas).toHaveLength(1);
  expect(alternada.marcas[0].fila.valor).toBe("ausente");
});

test("RF-307: el lote de push lleva cada marca y cada lista una sola vez", () => {
  const idLista = idListaAsistencia(sesionId, "grupo-1");
  const pendientes: Pendientes = {
    marcas: [crearMarca(datosMarca()), crearMarca(datosMarca({ catequizandoId: "otro-nino" }))],
    listas: [
      {
        id: idLista,
        fila: {
          id: idLista,
          ciclo_id: "33333333-3333-4333-8333-333333333333",
          sesion_id: sesionId,
          grupo_id: "grupo-1",
          confirmada_por: "44444444-4444-4444-8444-444444444444",
          cuenta_id: "44444444-4444-4444-8444-444444444444",
          credencial_id: "55555555-5555-4555-8555-555555555555",
          dispositivo_id: "66666666-6666-4666-8666-666666666666",
          abierta_en: "2026-10-19T08:55:00.000Z",
          confirmada_en: "2026-10-19T09:00:00.000Z",
          desfase_reloj_ms: 0,
          total_presentes: 1,
          total_ausentes: 0,
        },
      },
    ],
  };

  const lote = prepararLote(pendientes);

  expect(lote.marcas_asistencia.created).toHaveLength(2);
  expect(lote.lista_asistencia.created).toHaveLength(1);
  expect(lote.marcas_asistencia.created.every((fila) => typeof fila.id === "string")).toBe(true);
  expect(lote.marcas_asistencia.created.some((fila) => "_status" in fila)).toBe(false);
  expect(lote.marcas_asistencia.created.some((fila) => "estado" in fila)).toBe(false);
  expect(resumenPendientes(pendientes)).toEqual({ marcas: 2, listas: 1, total: 3 });
});

test("RF-307: tras el push se retiran del local solo las marcas aceptadas", () => {
  const primera = crearMarca(datosMarca());
  const segunda = crearMarca(datosMarca({ catequizandoId: "otro-nino" }));
  const pendientes = guardarMarca(guardarMarca(PENDIENTES_VACIOS, primera), segunda);

  const resultado = aplicarResultadoPush(pendientes, [primera.id]);

  expect(resultado.marcas).toHaveLength(1);
  expect(resultado.marcas[0].id).toBe(segunda.id);

  const repetido = aplicarResultadoPush(resultado, [primera.id]);
  expect(repetido.marcas).toHaveLength(1);
});
