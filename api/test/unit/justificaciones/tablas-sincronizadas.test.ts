import { randomUUID } from "node:crypto";
import { tablaJustificacionesEstado } from "@/lib/justificaciones/tablas-sincronizadas";
import { PROYECCIONES_LOCALES, esCampoRestringido, validarProyeccionLocal } from "@/lib/seguridad/catalogo-datos";
import { obtenerTablas } from "@/lib/sincronizacion/registro-tablas";
import { esquemaPush } from "../../../src/modulos/sincronizacion/dominio/validacion";

test("RF-410: el esquema local de justificaciones no tiene causa, motivo, enviada_por ni evidencia", () => {
  const columnas = Object.keys(tablaJustificacionesEstado.columnas);
  expect(columnas.sort()).toEqual(["catequizando_id", "estado", "fecha", "sesion_id", "tipo_sesion"]);
  expect(columnas.some(c => /causa|motivo|enviada|registrada|revisada|evidencia|apoderado|canal/.test(c))).toBe(false);
  expect(() => validarProyeccionLocal("justificaciones_estado", ["id", ...columnas])).not.toThrow();
  for (const fuente of Object.values(PROYECCIONES_LOCALES.justificaciones_estado!)) expect(esCampoRestringido(fuente.entidad, fuente.campo)).toBe(false);
  expect(obtenerTablas().find(t => t.nombre === "justificaciones_estado")).toMatchObject({ sentido: "pull", permiteActualizaciones: false });
});

test("RF-410: el push rechaza cambios a justificaciones_estado", () => {
  const fila = { id: randomUUID(), catequizando_id: randomUUID(), sesion_id: randomUUID(), fecha: "2026-11-08", tipo_sesion: "misa", estado: "aprobada" };
  expect(esquemaPush.safeParse({ changes: { justificaciones_estado: { created: [fila], updated: [], deleted: [] } } }).success).toBe(false);
  expect(esquemaPush.safeParse({ changes: { justificaciones_estado: { created: [], updated: [fila], deleted: [] } } }).success).toBe(false);
});
