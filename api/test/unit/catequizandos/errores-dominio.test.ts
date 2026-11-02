import { edadEnFecha, esFechaCivil, estaEnRangoCatequesis } from "@/lib/catequizandos/edad";
import { claveDuplicado, normalizarTexto } from "@/lib/catequizandos/duplicados";
import { aplicarCambioDocumento, cuentaComoPendiente } from "@/lib/catequizandos/documentos";
import { validarCondiciones, LARGO_MAXIMO_NOTA, CATEGORIAS_CONDICION } from "@/lib/catequizandos/condiciones";
import { sugerirGrupos, puedeCerrarGrupo } from "@/lib/catequizandos/grupos";
import { validarVinculo } from "@/lib/catequizandos/apoderados";
import type { Grupo } from "@/lib/catequizandos/modelo";

describe("Provocacion de errores y limites de dominio en catequizandos", () => {
  test("RF-201: normalizacion con caracteres de control, saltos de linea y unicode atipico", () => {
    expect(normalizarTexto("  MAríA\n\t  JosE  ")).toBe("maria jose");
    expect(normalizarTexto("Áéíóú  ñ")).toBe("aeiou n");
    expect(claveDuplicado("  JOSÉ\t", "PÉREZ\n", "2016-04-01")).toBe(claveDuplicado("jose", "perez", "2016-04-01"));
    expect(claveDuplicado("José", "Pérez", "2016-04-01")).not.toBe(claveDuplicado("José", "Pérez", "2016-04-02"));
  });

  test("RF-202: fechas bisiestas invalidas, meses fuera de rango y formato no ISO lanzan error o devuelven falso", () => {
    // 2025 y 2026 no son bisiestos; 2024 si lo es.
    expect(esFechaCivil("2025-02-29")).toBe(false);
    expect(esFechaCivil("2026-02-29")).toBe(false);
    expect(esFechaCivil("2024-02-29")).toBe(true);

    // Meses y dias fuera de rango civil.
    expect(esFechaCivil("2026-00-15")).toBe(false);
    expect(esFechaCivil("2026-13-01")).toBe(false);
    expect(esFechaCivil("2026-04-31")).toBe(false);
    expect(esFechaCivil("texto-invalido")).toBe(false);
    expect(esFechaCivil("2026/04/01")).toBe(false);

    // Fechas donde nacimiento es posterior a la referencia o civilmente no existen.
    expect(() => edadEnFecha("2026-02-29", "2026-04-01")).toThrow("fecha_invalida");
    expect(() => edadEnFecha("2027-01-01", "2026-04-01")).toThrow("fecha_invalida");
  });

  test("RF-202: rango de catequesis estricto rechaza edades no enteras y limites exteriores", () => {
    expect(estaEnRangoCatequesis(7)).toBe(false);
    expect(estaEnRangoCatequesis(8)).toBe(true);
    expect(estaEnRangoCatequesis(13)).toBe(true);
    expect(estaEnRangoCatequesis(14)).toBe(false);
    expect(estaEnRangoCatequesis(7.99)).toBe(false);
    expect(estaEnRangoCatequesis(13.01)).toBe(false);
    expect(estaEnRangoCatequesis(NaN)).toBe(false);
    expect(estaEnRangoCatequesis(Infinity)).toBe(false);
  });

  test("RF-204: transiciones de documentos invalidas y omision de motivo obligatorio", () => {
    // Pasar de no_aplica a entregado sin antes pasar por pendiente esta prohibido.
    const transicionDirecta = aplicarCambioDocumento("no_aplica", { estado: "entregado" });
    expect(transicionDirecta.valido).toBe(false);
    expect(transicionDirecta.codigo).toBe("transicion_documental_invalida");

    // Pasar de entregado a pendiente no esta permitido directamente.
    const entregadoAPendiente = aplicarCambioDocumento("entregado", { estado: "pendiente" });
    expect(entregadoAPendiente.valido).toBe(false);
    expect(entregadoAPendiente.codigo).toBe("transicion_documental_invalida");

    // Marcar como invalido exige obligatoriamente un motivo no vacio.
    const invalidoSinMotivo = aplicarCambioDocumento("entregado", { estado: "invalido", motivo: "   " });
    expect(invalidoSinMotivo.valido).toBe(false);
    expect(invalidoSinMotivo.codigo).toBe("motivo_obligatorio");

    // Exonerar de pendiente a no_aplica exige motivo explicito.
    const noAplicaSinMotivo = aplicarCambioDocumento("pendiente", { estado: "no_aplica", motivo: "" });
    expect(noAplicaSinMotivo.valido).toBe(false);
    expect(noAplicaSinMotivo.codigo).toBe("motivo_obligatorio");

    // Cuenta como pendiente solo estados no completados.
    expect(cuentaComoPendiente("pendiente")).toBe(true);
    expect(cuentaComoPendiente("invalido")).toBe(true);
    expect(cuentaComoPendiente("entregado")).toBe(false);
    expect(cuentaComoPendiente("no_aplica")).toBe(false);
  });

  test("RF-205: rechazo de categorias fuera de lista cerrada, notas mayores a 200 caracteres y categorias duplicadas", () => {
    // Categoria ajena a la lista cerrada definida por la constitucion.
    expect(validarCondiciones([{ categoria: "diagnostico_clinico" }])).toBe(false);
    expect(validarCondiciones([{ categoria: "asperger" }])).toBe(false);

    // Todas las categorias validas deben ser admitidas.
    for (const cat of CATEGORIAS_CONDICION) {
      expect(validarCondiciones([{ categoria: cat }])).toBe(true);
    }

    // Limite de 200 caracteres en nota de apoyo.
    const notaExacta200 = "x".repeat(LARGO_MAXIMO_NOTA);
    const notaExcedida201 = "x".repeat(LARGO_MAXIMO_NOTA + 1);
    expect(validarCondiciones([{ categoria: "otra", nota: notaExacta200 }])).toBe(true);
    expect(validarCondiciones([{ categoria: "otra", nota: notaExcedida201 }])).toBe(false);

    // Duplicados de categoria para el mismo nino.
    expect(validarCondiciones([{ categoria: "alergia" }, { categoria: "alergia" }])).toBe(false);
  });

  test("RF-206: grupos cerrados o con ninos activos impiden asignacion o cierre", () => {
    const grupos: Grupo[] = [
      { id: "g1", cicloId: "c1", nombre: "A", edadMinima: 8, edadMaxima: 10, modalidad: "mixto", estado: "cerrado" },
      { id: "g2", cicloId: "c1", nombre: "B", edadMinima: 11, edadMaxima: 13, modalidad: "masculino", estado: "abierto" }
    ];

    // Nino de 8 anos no recibe grupos sugeridos porque el unico correspondiente esta cerrado.
    expect(sugerirGrupos(8, "femenino", grupos)).toEqual([]);

    // Nino de sexo femenino de 12 anos no puede sugerirse en grupo masculino.
    expect(sugerirGrupos(12, "femenino", grupos)).toEqual([]);

    // No se puede cerrar un grupo si tiene al menos 1 nino activo.
    expect(puedeCerrarGrupo(1)).toBe(false);
    expect(puedeCerrarGrupo(5)).toBe(false);
    expect(puedeCerrarGrupo(0)).toBe(true);
  });

  test("RF-207: relaciones de apoderado restringidas a circulo familiar y tutores legales", () => {
    expect(validarVinculo({ relacion: "madre" })).toBe(true);
    expect(validarVinculo({ relacion: "padre" })).toBe(true);
    expect(validarVinculo({ relacion: "tutor" })).toBe(true);
    expect(validarVinculo({ relacion: "otro_familiar", detalleRelacion: "abuelo" })).toBe(true);

    // Vinculos no reconocidos legalmente en catequesis o con detalle que excede 100 caracteres.
    expect(validarVinculo({ relacion: "vecino" })).toBe(false);
    expect(validarVinculo({ relacion: "conocido" })).toBe(false);
    expect(validarVinculo({ relacion: "hermano_menor" })).toBe(false);
    expect(validarVinculo({ relacion: "otro_familiar", detalleRelacion: "a".repeat(101) })).toBe(false);
    expect(validarVinculo({ relacion: "otro_familiar", detalleRelacion: "a".repeat(100) })).toBe(true);
  });
});
