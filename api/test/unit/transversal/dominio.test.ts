import { validarAperturaCiclo, transicionCiclo, puedeCrearRegistrosLocales } from "@/lib/ciclos/ciclo";
import { clasificarRegistroEntrante, debePurgarseLocalmente } from "@/lib/ciclos/cierre";
import { TIPOS_ACTIVIDAD, validarActividad } from "@/lib/actividades/catalogo-actividades";
import { actividadSumaFalta } from "@/lib/actividades/falta-actividad";
import { obtenerTablas } from "@/lib/sincronizacion/registro-tablas";
const ciclo = { id: "ciclo", nombre: "2020", fechaInicio: "2020-03-01", fechaFin: "2020-12-31", estado: "abierto" as const };
test("RF-801 RF-803: apertura válida, un solo abierto y cierre irreversible idempotente", () => {
  expect(validarAperturaCiclo(ciclo, null)).toBe(true);
  expect(validarAperturaCiclo(ciclo, ciclo)).toBe(false);
  expect(validarAperturaCiclo({ ...ciclo, fechaFin: ciclo.fechaInicio }, null)).toBe(false);
  expect(validarAperturaCiclo({ ...ciclo, fechaInicio: "2020-02-30" }, null)).toBe(false);
  expect(validarAperturaCiclo({ ...ciclo, nombre: " " }, null)).toBe(false);
  expect(transicionCiclo("cerrado", "cerrar")).toBe("cerrado");
  expect(() => transicionCiclo("cerrado", "reabrir")).toThrow();
  expect(puedeCrearRegistrosLocales(null)).toBe(false);
});
test("RF-802: distingue reintento ya aplicado y descarte tardío; purga ciclos anteriores", () => {
  expect(clasificarRegistroEntrante({ cicloIdRegistro: "a", cicloAbiertoId: "b", yaExiste: true, sinCambios: true })).toBe("ya_aplicado");
  expect(clasificarRegistroEntrante({ cicloIdRegistro: "a", cicloAbiertoId: "b", yaExiste: true, sinCambios: false })).toBe("descartar_ciclo_cerrado");
  expect(debePurgarseLocalmente("a", null)).toBe(true);
});
test("RF-504: seis tipos válidos, solo jornada vigente suma falta (S-5)", () => {
  for (const tipo of TIPOS_ACTIVIDAD) {
    expect(validarActividad({ id: "a", cicloId: "c", nombre: "Encuentro", fecha: "2020-10-04", tipo, estado: "vigente" })).toBe(true);
    expect(actividadSumaFalta({ tipo, estado: "vigente" })).toBe(tipo === "jornada");
    expect(actividadSumaFalta({ tipo, estado: "cancelada" })).toBe(false);
  }
});
test("RF-801 RF-504: esquema local registra ciclos solo pull y catálogo operativo editable", () => {
  expect(obtenerTablas().find(tabla => tabla.nombre === "ciclos")).toMatchObject({ sentido: "pull" });
  expect(obtenerTablas().find(tabla => tabla.nombre === "actividades_obligatorias")).toMatchObject({ sentido: "ambos", permiteActualizaciones: true, tablaSql: "actividad_obligatoria" });
});
