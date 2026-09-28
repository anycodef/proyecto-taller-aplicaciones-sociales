import { describe, expect, it } from "vitest";
import { Catequizando, type EntradaInscripcion } from "./catequizando";
import { ErrorDeValidacion } from "./errores";

const AHORA = new Date("2026-09-28T12:00:00Z");

const consentimientoValido = {
  otorgadoPor: "Apoderado ficticio",
  otorgadoEn: "2026-09-01T10:00:00Z",
  version: "v1",
  retencionHasta: "2029-09-01",
};

const entradaValida = (cambios: Partial<EntradaInscripcion> = {}): EntradaInscripcion => ({
  id: "cat-100",
  grupoId: "grp-8",
  nombres: "Luca",
  apellidos: "Herrera Quispe",
  fechaNacimiento: "2018-01-15", // 8 años a la fecha de prueba
  consentimiento: consentimientoValido,
  ...cambios,
});

const inscribir = (cambios: Partial<EntradaInscripcion> = {}, grupoExiste = true) =>
  Catequizando.inscribir(entradaValida(cambios), { ahora: AHORA, grupoExiste });

describe("Invariante 1: no existe catequizando sin consentimiento informado completo", () => {
  it("inscribe cuando el consentimiento está completo", () => {
    expect(inscribir().aDetalle().consentimiento).toEqual(consentimientoValido);
  });

  it("rechaza la inscripción sin consentimiento", () => {
    expect(() => inscribir({ consentimiento: undefined })).toThrow(ErrorDeValidacion);
    expect(() => inscribir({ consentimiento: null })).toThrow(ErrorDeValidacion);
  });

  it.each(["otorgadoPor", "otorgadoEn", "version", "retencionHasta"] as const)(
    "rechaza el consentimiento con %s ausente o vacío",
    (campo) => {
      expect(() => inscribir({ consentimiento: { ...consentimientoValido, [campo]: "" } })).toThrow(
        ErrorDeValidacion,
      );
      expect(() => inscribir({ consentimiento: { ...consentimientoValido, [campo]: "   " } })).toThrow(
        ErrorDeValidacion,
      );
      const { [campo]: _omitido, ...sinCampo } = consentimientoValido;
      expect(() => inscribir({ consentimiento: sinCampo })).toThrow(ErrorDeValidacion);
    },
  );

  it("rechaza retencionHasta igual o anterior a otorgadoEn", () => {
    const otorgadoEn = "2026-09-01T10:00:00Z";
    expect(() =>
      inscribir({ consentimiento: { ...consentimientoValido, otorgadoEn, retencionHasta: "2026-09-01T10:00:00Z" } }),
    ).toThrow(ErrorDeValidacion);
    expect(() =>
      inscribir({ consentimiento: { ...consentimientoValido, otorgadoEn, retencionHasta: "2026-01-01" } }),
    ).toThrow(ErrorDeValidacion);
  });

  it("rechaza fechas del consentimiento que no son fechas", () => {
    expect(() =>
      inscribir({ consentimiento: { ...consentimientoValido, retencionHasta: "no-es-fecha" } }),
    ).toThrow(ErrorDeValidacion);
  });
});

describe("Invariante 2: la edad a la fecha actual está entre 8 y 13 años", () => {
  it("acepta 8 y 13 años cumplidos", () => {
    expect(inscribir({ fechaNacimiento: "2018-09-28" }).edad(AHORA)).toBe(8); // cumple 8 hoy
    expect(inscribir({ fechaNacimiento: "2012-09-29" }).edad(AHORA)).toBe(13); // cumple 14 mañana
  });

  it("rechaza a quien aún no cumplió 8 años", () => {
    expect(() => inscribir({ fechaNacimiento: "2018-09-29" })).toThrow(ErrorDeValidacion); // cumple 8 mañana
    expect(() => inscribir({ fechaNacimiento: "2024-01-01" })).toThrow(ErrorDeValidacion);
  });

  it("rechaza a quien ya cumplió 14 años", () => {
    expect(() => inscribir({ fechaNacimiento: "2012-09-28" })).toThrow(ErrorDeValidacion); // cumple 14 hoy
    expect(() => inscribir({ fechaNacimiento: "2000-01-01" })).toThrow(ErrorDeValidacion);
  });

  it("rechaza fechas con formato inválido, inexistentes o futuras", () => {
    expect(() => inscribir({ fechaNacimiento: "15/01/2018" })).toThrow(ErrorDeValidacion);
    expect(() => inscribir({ fechaNacimiento: "2018-02-30" })).toThrow(ErrorDeValidacion);
    expect(() => inscribir({ fechaNacimiento: "2030-01-01" })).toThrow(ErrorDeValidacion);
  });
});

describe("Invariante 3: nombres y apellidos no vacíos, y el grupo debe existir", () => {
  it("rechaza nombres o apellidos vacíos", () => {
    expect(() => inscribir({ nombres: "" })).toThrow(ErrorDeValidacion);
    expect(() => inscribir({ nombres: "  " })).toThrow(ErrorDeValidacion);
    expect(() => inscribir({ apellidos: "" })).toThrow(ErrorDeValidacion);
  });

  it("rechaza un grupo que no existe", () => {
    expect(() => inscribir({ grupoId: "grp-99" }, false)).toThrow(ErrorDeValidacion);
  });

  it("rechaza un grupoId vacío", () => {
    expect(() => inscribir({ grupoId: "" })).toThrow(ErrorDeValidacion);
  });
});

describe("Formas de salida", () => {
  it("el resumen del listado solo trae id, grupoId, nombres, apellidos y edad", () => {
    expect(inscribir().aResumen(AHORA)).toEqual({
      id: "cat-100",
      grupoId: "grp-8",
      nombres: "Luca",
      apellidos: "Herrera Quispe",
      edad: 8,
    });
  });

  it("el detalle incluye fechaNacimiento y consentimiento, y apoderadoIds vacío por defecto", () => {
    const detalle = inscribir().aDetalle();
    expect(detalle.fechaNacimiento).toBe("2018-01-15");
    expect(detalle.consentimiento).toEqual(consentimientoValido);
    expect(detalle.apoderadoIds).toEqual([]);
  });
});
