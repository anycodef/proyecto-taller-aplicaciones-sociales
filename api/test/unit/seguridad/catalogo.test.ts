import { CATALOGO, COLUMNAS_TECNICAS, PROYECCIONES_LOCALES, TABLAS_INFRAESTRUCTURA, camposRestringidos, esCampoRestringido, camposSinCatalogar, validarCoberturaCatalogo, validarProyeccionLocal, registrarDatos } from "@/lib/seguridad/catalogo-datos";
import { tablasAsistencia } from "@/lib/asistencia/tablas-sincronizadas";
import { tablaActividades } from "@/lib/actividades/tablas-sincronizadas";
import { tablaCiclos } from "@/lib/ciclos/tablas-sincronizadas";

test("RF-107: catálogo cerrado tiene clasificación y finalidad por entidad/campo sin duplicados ni datos extra de cuenta", () => {
  const claves = CATALOGO.map(e => `${e.entidad}.${e.campo}`);
  expect(new Set(claves).size).toBe(claves.length);
  for (const entrada of CATALOGO) {
    expect(["operativo", "restringido", "identidad-equipo"]).toContain(entrada.clasificacion);
    expect(["formar-grupos", "aptitud", "operacion", "contacto"]).toContain(entrada.finalidad);
    expect(COLUMNAS_TECNICAS[entrada.entidad] ?? []).not.toContain(entrada.campo);
  }
  expect(CATALOGO.filter(e => e.entidad === "cuenta").map(e => e.campo).sort()).toEqual(["activa", "es_menor", "identidad_operativa"]);
  expect(CATALOGO.some(e => e.entidad === "cuenta" && ["telefono", "correo", "pin", "pin_hash"].includes(e.campo))).toBe(false);
  expect(CATALOGO.find(e => e.entidad === "apoderado" && e.campo === "valor_contacto")?.finalidad).toBe("contacto");
});

test("RF-107 RNF-101: clasificación sensible distingue entidades aunque los campos tengan el mismo nombre", () => {
  for (const campo of ["nombres", "apellidos", "fecha_nacimiento"]) {
    expect(esCampoRestringido("identidad_real", campo)).toBe(true);
    expect(esCampoRestringido("catequizando", campo)).toBe(false);
  }
  expect(esCampoRestringido("condicion_catequizando", "categoria")).toBe(true);
  expect(esCampoRestringido("condicion_catequizando", "nota")).toBe(true);
  expect(esCampoRestringido("cambio_inscripcion", "valor_nuevo")).toBe(true);
  expect(esCampoRestringido("correccion_asistencia", "valor_nuevo")).toBe(false);
  expect(esCampoRestringido("credencial", "token_hash")).toBe(true);
  expect(esCampoRestringido("sesion_renovacion", "hash_actual")).toBe(true);
  expect(camposRestringidos()).toContain("nombres");
  expect(() => validarProyeccionLocal("catequizandos", ["id", "nombres", "apellidos"])).not.toThrow();
});

test("RF-107: lista técnica finita no admite columnas o entidades nuevas por sufijos o por nombres comunes", () => {
  const nuevas = [
    { entidad: "catequizando", campo: "diagnostico_nuevo" },
    { entidad: "catequizando", campo: "documento_nuevo_id" },
    { entidad: "catequizando", campo: "diagnostico_en" },
    { entidad: "persona_nueva", campo: "id" },
    { entidad: "persona_nueva", campo: "estado" },
  ];
  expect(camposSinCatalogar(nuevas)).toEqual(nuevas);
  expect(() => validarCoberturaCatalogo(nuevas)).toThrow("campos_sin_catalogar");
  expect(TABLAS_INFRAESTRUCTURA).toEqual(["esquema_migracion"]);
  expect(() => validarCoberturaCatalogo([{ entidad: "esquema_migracion", campo: "checksum_sha256" }])).not.toThrow();
});

test("RNF-101 RF-112: todas las columnas de las colecciones operativas existentes tienen proyección local aprobada", () => {
  for (const tabla of [...tablasAsistencia, tablaActividades, tablaCiclos]) {
    expect(() => validarProyeccionLocal(tabla.nombre, ["id", ...Object.keys(tabla.columnas)])).not.toThrow();
  }
  for (const [coleccion, proyeccion] of Object.entries(PROYECCIONES_LOCALES)) {
    expect(() => validarProyeccionLocal(coleccion, Object.keys(proyeccion))).not.toThrow();
    for (const fuente of Object.values(proyeccion)) expect(esCampoRestringido(fuente.entidad, fuente.campo)).toBe(false);
  }
  for (const tabla of tablasAsistencia.filter(t => t.sentido === "ambos")) {
    expect(Object.keys(tabla.columnas)).toEqual(expect.arrayContaining(["cuenta_id", "credencial_id"]));
  }
});

test("RNF-101: documentos, contacto, historial, identidad y tokens no entran al almacén aunque algunos campos sean operativos", () => {
  expect(esCampoRestringido("documento_inscripcion", "estado")).toBe(false);
  for (const coleccion of ["documento_inscripcion", "documentos_inscripcion", "apoderados", "condiciones_catequizando", "identidades_reales", "credenciales", "sesiones_renovacion", "cambios_inscripcion", "__proto__"]) {
    expect(() => validarProyeccionLocal(coleccion, ["id"])).toThrow("coleccion_local_no_permitida");
  }
  for (const campo of ["fecha_nacimiento", "bautizado", "sexo", "nota", "categoria", "valor_contacto", "token_hash", "salud_nueva"]) {
    expect(() => validarProyeccionLocal("catequizandos", [campo])).toThrow("campo_local_no_permitido");
  }
});

test("RF-105 RF-103: autor visible de avisos se proyecta exclusivamente desde identidad operativa", () => {
  expect(PROYECCIONES_LOCALES.avisos_grupo?.autor_visible).toEqual({ entidad: "cuenta", campo: "identidad_operativa" });
  expect(() => validarProyeccionLocal("avisos_grupo", ["id", "grupo_id", "texto", "autor_visible", "publicado_en"])).not.toThrow();
  expect(() => validarProyeccionLocal("avisos_grupo", ["nombres"])).toThrow("campo_local_no_permitido");
  expect(PROYECCIONES_LOCALES.catequizandos?.codigo_carne).toEqual({ entidad: "carne_emision", campo: "emision" });
});

test("RF-107: extender un catálogo devuelve copia inmutable y no modifica clasificación ni estado global", () => {
  const original = CATALOGO.map(e => ({ ...e }));
  const copia = registrarDatos([{ entidad: "modulo_futuro", campo: "condicion", clasificacion: "restringido", finalidad: "aptitud" }]);
  expect(copia.length).toBe(CATALOGO.length + 1);
  expect(CATALOGO).toEqual(original);
  expect(Object.isFrozen(CATALOGO)).toBe(true);
  expect(CATALOGO.every(Object.isFrozen)).toBe(true);
  expect(Object.isFrozen(copia)).toBe(true);
  expect(() => registrarDatos([{ entidad: "identidad_real", campo: "nombres", clasificacion: "operativo", finalidad: "operacion" }])).toThrow("clasificacion_dato_incompatible");
  expect(() => registrarDatos([{ entidad: "apoderado", campo: "valor_contacto", clasificacion: "operativo", finalidad: "operacion" }])).toThrow("clasificacion_dato_incompatible");
});
