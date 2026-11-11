import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Falta } from "@/lib/asistencia/tipos";
import type { Tx } from "../../../src/compartido/bd/transaccion";
import { consultarFaltas } from "../../../src/modulos/asistencia/aplicacion/consultar-faltas";
import { obtenerFuenteInscripciones } from "../../../src/modulos/asistencia/infraestructura/fuente-inscripciones-pg";
import { cicloAbierto } from "../../../src/modulos/ciclos/aplicacion/guardia-ciclo";
import { consultarListaRiesgo } from "../../../src/modulos/riesgo/aplicacion/consultar-lista-riesgo";

jest.mock("../../../src/modulos/asistencia/aplicacion/consultar-faltas", () => ({ consultarFaltas: jest.fn() }));
jest.mock("../../../src/modulos/asistencia/infraestructura/fuente-inscripciones-pg", () => ({ obtenerFuenteInscripciones: jest.fn() }));
jest.mock("../../../src/modulos/ciclos/aplicacion/guardia-ciclo", () => ({ cicloAbierto: jest.fn() }));

const cicloId = "00100000-0000-4000-8000-000000000001";
const grupoA = "00200000-0000-4000-8000-00000000000a";
const grupoB = "00200000-0000-4000-8000-00000000000b";
const ninoA = "00300000-0000-4000-8000-00000000000a";
const ninoB = "00300000-0000-4000-8000-00000000000b";
const ahora = new Date("2026-11-10T12:00:00Z");
const contexto = (rolesPropios: ContextoAcceso["rolesPropios"], gruposAsignados: string[] = []): ContextoAcceso => ({
  cuentaId: "00400000-0000-4000-8000-000000000001",
  credencialId: "00400000-0000-4000-8000-000000000001",
  rolesPropios,
  gruposAsignados,
  catequizandosApoderados: [],
  identidadOperativa: "Equipo demo",
  esMenor: false,
});
const falta = (catequizandoId: string, fecha: string, origen: Falta["origen"] = "domingo"): Falta => ({
  catequizandoId,
  fecha,
  origen,
  sesionIds: [`sesion-${fecha}`],
  justificada: false,
});
const tx = {
  query: jest.fn().mockResolvedValue({
    rows: [
      { id: grupoA, nombre: "Grupo A" },
      { id: grupoB, nombre: "Grupo B" },
    ],
  }),
} as unknown as Tx;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(cicloAbierto).mockResolvedValue(cicloId);
  jest.mocked(obtenerFuenteInscripciones).mockReturnValue({
    activosEnFecha: jest.fn().mockResolvedValue([
      { catequizandoId: ninoA, grupoId: grupoA, nombre: "Ana Demo" },
      { catequizandoId: ninoB, grupoId: grupoB, nombre: "Beto Demo" },
    ]),
  });
  jest.mocked(consultarFaltas).mockResolvedValue([
    falta(ninoA, "2026-10-18"),
    falta(ninoA, "2026-10-25"),
    falta(ninoA, "2026-10-20", "jornada"),
    falta(ninoB, "2026-10-11"),
    falta(ninoB, "2026-10-18"),
    falta(ninoB, "2026-10-25"),
  ]);
});

test("RF-707: coordinación ve todos los grupos ordenados por paso", async () => {
  const lista = await consultarListaRiesgo(contexto(["coordinacion"]), ahora, tx);

  expect(lista.map((fila) => fila.catequizandoId)).toEqual([ninoB, ninoA]);
  expect(lista[0]).toMatchObject({ grupoNombre: "Grupo B", paso: "citacion", conteo: 3 });
  expect(lista[1]).toMatchObject({ grupoNombre: "Grupo A", paso: "contacto", conteo: 2 });
  expect(lista[1]?.faltasOrigen).toHaveLength(2);
});

test("RF-707: el catequista solo ve los grupos que tiene asignados", async () => {
  const lista = await consultarListaRiesgo(contexto(["catequista"], [grupoA]), ahora, tx);

  expect(lista).toHaveLength(1);
  expect(lista[0]).toMatchObject({ catequizandoId: ninoA, grupoNombre: "Grupo A" });
});

test("RF-707: sin ciclo abierto no se consulta la asistencia", async () => {
  jest.mocked(cicloAbierto).mockResolvedValue(null);
  const lista = await consultarListaRiesgo(contexto(["coordinacion"]), ahora, tx);

  expect(lista).toEqual([]);
  expect(consultarFaltas).not.toHaveBeenCalled();
});
