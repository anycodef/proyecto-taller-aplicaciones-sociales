import { MODULOS, modulosDelPanel, type Modulo } from "../modulos";
import { permisoPara } from "@/lib/seguridad/matriz-permisos";

// El registro debe reflejar las pantallas reales: se leen las rutas de src/app.
const fs = jest.requireActual("node:fs");
const path = jest.requireActual("node:path");
const carpetaApp: string = path.resolve(jest.requireActual("node:process").cwd(), "src/app");

function rutasDeExpoRouter(): Set<string> {
  const archivos: string[] = fs.readdirSync(carpetaApp, { recursive: true });
  return new Set(
    archivos
      .filter((archivo) => /\.tsx$/.test(archivo) && !/(^|\/)_layout\.tsx$/.test(archivo) && !archivo.includes("__tests__"))
      .map((archivo) => {
        const segmentos = archivo.replace(/\.tsx$/, "").split(path.sep).filter((s) => !/^\(.*\)$/.test(s));
        if (segmentos.at(-1) === "index") segmentos.pop();
        return `/${segmentos.join("/")}`;
      }),
  );
}

const modulo = (cambios: Partial<Modulo>): Modulo => ({
  id: "prueba",
  spec: "007",
  panel: "coordinacion",
  titulo: "Prueba",
  subtitulo: "Prueba",
  ruta: "/riesgo",
  accion: "riesgo:leer",
  estado: "disponible",
  ...cambios,
});

describe("registro de modulos", () => {
  test("RF-1206: cada modulo disponible tiene su pantalla en src/app y su permiso en la matriz", () => {
    const rutas = rutasDeExpoRouter();
    expect(rutas.has("/asistencia")).toBe(true);
    for (const m of MODULOS.filter((x) => x.estado === "disponible")) {
      expect({ id: m.id, rutaExiste: rutas.has(m.ruta), permisoExiste: permisoPara(m.accion) !== undefined }).toEqual({ id: m.id, rutaExiste: true, permisoExiste: true });
    }
  });

  test("RF-1206: el registro cubre 003, 004 y 007 con identificadores y rutas unicos", () => {
    expect(new Set(MODULOS.map((m) => m.spec))).toEqual(new Set(["003", "004", "007"]));
    expect(new Set(MODULOS.map((m) => m.id)).size).toBe(MODULOS.length);
    expect(new Set(MODULOS.map((m) => m.ruta)).size).toBe(MODULOS.length);
    for (const m of MODULOS) expect(m.ruta).toMatch(/^\/[a-z0-9/-]+$/);
  });

  test("RF-1206: un modulo disponible se enlaza solo para los roles con su permiso", () => {
    const riesgo = [modulo({})];
    expect(modulosDelPanel("coordinacion", ["coordinacion"], riesgo).conectados.map((m) => m.id)).toEqual(["prueba"]);
    expect(modulosDelPanel("coordinacion", ["supervision"], riesgo)).toEqual({ conectados: [], proximamente: [] });
    expect(modulosDelPanel("familia", ["coordinacion"], riesgo)).toEqual({ conectados: [], proximamente: [] });
  });

  test("RF-1206: un modulo pendiente o con permiso aun no creado se anuncia como proximo y no se enlaza", () => {
    const pendientes = [modulo({ id: "pendiente", estado: "pendiente" }), modulo({ id: "sin-permiso", accion: "modulo:inexistente" })];
    expect(modulosDelPanel("coordinacion", ["coordinacion"], pendientes)).toEqual({ conectados: [], proximamente: pendientes });
  });

  test("RF-1206: en cada panel los modulos disponibles se enlazan y los pendientes se anuncian para su rol", () => {
    for (const [panel, rol] of [["coordinacion", "coordinacion"], ["familia", "familia"]] as const) {
      const propios = MODULOS.filter((m) => m.panel === panel);
      const { conectados, proximamente } = modulosDelPanel(panel, [rol]);
      expect(conectados.map((m) => m.id)).toEqual(propios.filter((m) => m.estado === "disponible").map((m) => m.id));
      expect(proximamente.map((m) => m.id)).toEqual(propios.filter((m) => m.estado === "pendiente").map((m) => m.id));
    }
  });
});
