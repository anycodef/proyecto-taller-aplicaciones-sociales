import { puedeGestionarInscripciones, puedeVerCondiciones, camposDePerfilVisibles } from "@/lib/catequizandos/autorizacion";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import * as esquemas from "../../../src/modulos/catequizandos/http/esquemas";
import { randomUUID } from "node:crypto";

describe("Provocacion de errores de autorizacion, alcance y esquemas HTTP en catequizandos", () => {
  const cuentaId = "00200000-0000-4000-8000-000000000001";
  const grupoPropio = "00200000-0000-4000-8000-000000000010";
  const grupoAjeno = "00200000-0000-4000-8000-000000000020";
  const ninoId = "00200000-0000-4000-8000-000000000100";
  const ninoAjenoId = "00200000-0000-4000-8000-000000000200";

  const armarContexto = (roles: Rol[], extras: Partial<ContextoAcceso> = {}): ContextoAcceso => ({
    cuentaId,
    credencialId: randomUUID(),
    rolesPropios: roles,
    gruposAsignados: [grupoPropio],
    catequizandosApoderados: [ninoId],
    identidadOperativa: "Luz Prueba",
    esMenor: true,
    ...extras,
  });

  test("RF-202: denegacion de gestion de inscripciones para roles no autorizados", () => {
    // Solo coordinacion o catequista con delegacion vigente pueden gestionar inscripciones.
    const rolesProhibidos: Rol[] = ["catequista", "familia", "supervision", "administracion"];
    for (const rol of rolesProhibidos) {
      expect(puedeGestionarInscripciones(armarContexto([rol]))).toBe(false);
    }

    // Catequista con delegacion expirada o nula no puede gestionar inscripciones.
    const catequistaSinDelegacion = armarContexto(["catequista"], { delegacionVigente: undefined });
    expect(puedeGestionarInscripciones(catequistaSinDelegacion)).toBe(false);

    // Coordinacion si tiene permiso.
    expect(puedeGestionarInscripciones(armarContexto(["coordinacion"]))).toBe(true);
  });

  test("RF-205 RNF-203: catequista no puede ver condiciones de ninos en grupos ajenos", () => {
    const catequista = armarContexto(["catequista"]);
    expect(puedeVerCondiciones(catequista, grupoPropio)).toBe(true);
    expect(puedeVerCondiciones(catequista, grupoAjeno)).toBe(false);
    expect(puedeVerCondiciones(catequista, undefined)).toBe(false);

    // Familia y supervision jamas deben ver condiciones independientemente del grupo.
    expect(puedeVerCondiciones(armarContexto(["familia"]), grupoPropio)).toBe(false);
    expect(puedeVerCondiciones(armarContexto(["supervision"]), grupoPropio)).toBe(false);
  });

  test("RF-201 RNF-203: familia solo observa datos operativos minimos y jamas apoderados ni historial", () => {
    const familia = armarContexto(["familia"]);

    // Nino vinculado a la familia.
    const visiblesHijo = camposDePerfilVisibles(familia, { id: ninoId, grupoId: grupoPropio });
    expect(visiblesHijo).toEqual(["nombre", "edad", "grupo", "documentos", "resumenes"]);
    expect(visiblesHijo).not.toContain("apoderados");
    expect(visiblesHijo).not.toContain("historialGrupos");

    // Nino ajeno: acceso totalmente denegado (lista vacia).
    const visiblesAjeno = camposDePerfilVisibles(familia, { id: ninoAjenoId, grupoId: grupoPropio });
    expect(visiblesAjeno).toEqual([]);

    // Supervision jamas tiene acceso al perfil de catequizando individual.
    const supervision = armarContexto(["supervision"]);
    expect(camposDePerfilVisibles(supervision, { id: ninoId, grupoId: grupoPropio })).toEqual([]);
  });

  test("RF-202 RF-206: esquemas estrictos rechazan campos desconocidos y payloads hostiles", () => {
    const ninoValido = {
      id: randomUUID(),
      nombres: "Mateo",
      apellidos: "Gomez",
      fechaNacimiento: "2016-05-10",
      sexo: "masculino",
      bautizado: true,
    };

    // Inyeccion de campos no permitidos en objeto nino.
    const ninoConDni = { ...ninoValido, dni: "12345678" };
    expect(esquemas.nino.safeParse(ninoConDni).success).toBe(false);

    // Inyeccion de campos en grupo y rango invertido.
    const grupoInvertido = {
      id: randomUUID(),
      cicloId: randomUUID(),
      nombre: "Grupo Invalido",
      edadMinima: 14,
      edadMaxima: 8,
      modalidad: "mixto",
    };
    expect(esquemas.grupo.safeParse(grupoInvertido).success).toBe(false);

    // Lista de documentos con tipos repetidos en alta.
    const documentosRepetidos = [
      { id: randomUUID(), tipo: "partida_nacimiento" },
      { id: randomUUID(), tipo: "partida_nacimiento" },
      { id: randomUUID(), tipo: "boleta_pago" },
      { id: randomUUID(), tipo: "documento_identidad" },
      { id: randomUUID(), tipo: "ficha_compromiso" },
    ];
    const inscripcionDocumentosRepetidos = {
      id: randomUUID(),
      nino: ninoValido,
      apoderados: [{ id: randomUUID(), apoderadoId: randomUUID(), relacion: "padre" }],
      grupoId: randomUUID(),
      asignacionId: randomUUID(),
      documentos: documentosRepetidos,
      edadFueraRangoConfirmada: false,
    };
    expect(esquemas.inscripcion.safeParse(inscripcionDocumentosRepetidos).success).toBe(false);
  });
});
