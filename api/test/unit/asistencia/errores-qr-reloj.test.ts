import { interpretarCodigoQr, resolverCarne } from "@/lib/asistencia/carne";
import { dentroDeVentana, estimarDesfase, horaEfectiva, compararInstantes } from "@/lib/asistencia/reloj";
import { ventanaDe } from "@/lib/asistencia/sesiones";
import type { Sesion, NinoNomina } from "@/lib/asistencia/tipos";

describe("Provocacion de errores y casos limite en QR y reloj de asistencia", () => {
  const ninoId = "42181323-e2ad-4e17-bd8a-93eb7178bc5b";
  const sesionMisa: Sesion = {
    id: "misa-1",
    cicloId: "ciclo-1",
    fecha: "2026-10-11",
    tipo: "misa",
    cancelada: false,
  };

  test("RF-302 RF-303: formatos QR anomalos, corrupciones e inyecciones de bytes no validos", () => {
    // Prefijos alterados o con mayusculas incorrectas.
    expect(interpretarCodigoQr(`sgc1:${ninoId}:1`)).toBeNull();
    expect(interpretarCodigoQr(`SGC2:${ninoId}:1`)).toBeNull();
    expect(interpretarCodigoQr(`SGC:${ninoId}:1`)).toBeNull();
    expect(interpretarCodigoQr(ninoId)).toBeNull();

    // Emisiones no admitidas: cero, flotantes, negativas o desbordamiento de entero de 32 bits.
    expect(interpretarCodigoQr(`SGC1:${ninoId}:0`)).toBeNull();
    expect(interpretarCodigoQr(`SGC1:${ninoId}:-1`)).toBeNull();
    expect(interpretarCodigoQr(`SGC1:${ninoId}:1.5`)).toBeNull();
    expect(interpretarCodigoQr(`SGC1:${ninoId}:01`)).toBeNull();
    expect(interpretarCodigoQr(`SGC1:${ninoId}:2147483648`)).toBeNull();
    expect(interpretarCodigoQr(`SGC1:${ninoId}:99999999999999999`)).toBeNull();

    // Inyecciones de saltos de linea o caracteres de escape.
    expect(interpretarCodigoQr(`SGC1:${ninoId}:1\n`)).toBeNull();
    expect(interpretarCodigoQr(`SGC1:${ninoId}:1\0`)).toBeNull();
    expect(interpretarCodigoQr(` SGC1:${ninoId}:1 `)).toBeNull();
    expect(interpretarCodigoQr(`SGC1:${ninoId}:1:extra`)).toBeNull();

    // Codigo valido reconocido con emision correcta.
    expect(interpretarCodigoQr(`SGC1:${ninoId}:5`)).toEqual({
      catequizandoId: ninoId,
      emision: 5,
    });
  });

  test("RF-303: resolver carné ante niños inactivos o no encontrados en nómina", () => {
    const nomina: NinoNomina[] = [
      { id: ninoId, nombres: "Ana", apellidos: "Prueba", grupoId: "g1", codigoCarne: `SGC1:${ninoId}:1`, activo: false },
    ];

    // Niño inactivo debe ser reportado explicitamente como inactivo.
    expect(resolverCarne(`SGC1:${ninoId}:1`, nomina)).toEqual({
      estado: "inactivo",
      nino: nomina[0],
    });

    // Código con emisión no coincidente o desconocido en nómina.
    expect(resolverCarne(`SGC1:${ninoId}:2`, nomina)).toEqual({ estado: "desconocido" });
    expect(resolverCarne("codigo-invalido", nomina)).toEqual({ estado: "desconocido" });
  });

  test("RF-302: estimacion de desfase de reloj y manejo de anomalias temporales", () => {
    // Estimacion normal: servidor=1000, enviado=500, recibido=700 -> (500+700)/2 = 600 -> desfase = 400.
    expect(estimarDesfase(1000, 500, 700)).toBe(400);

    // Error cuando el tiempo de recepcion es anterior al envio (viaje en el tiempo imposible).
    expect(() => estimarDesfase(1000, 700, 500)).toThrow("Reloj inválido");

    // Valores no finitos (NaN, Infinity).
    expect(() => estimarDesfase(NaN, 500, 700)).toThrow("Reloj inválido");
    expect(() => estimarDesfase(1000, 500, Infinity)).toThrow("Reloj inválido");
  });

  test("RF-302: hora efectiva y rechazo de desfases mayores a 24 horas o horas invalidas", () => {
    const baseIso = "2026-10-11T08:00:00-05:00";
    const baseMs = Date.parse(baseIso);

    // Desfase dentro del limite maximo permitido (86400000 ms = 24 horas).
    expect(horaEfectiva(baseIso, 1000)).toBe(baseMs + 1000);
    expect(horaEfectiva(baseIso, -3600000)).toBe(baseMs - 3600000);

    // Desfase mayor a 24 horas es rechazado.
    expect(() => horaEfectiva(baseIso, 86400001)).toThrow("Reloj inválido");
    expect(() => horaEfectiva(baseIso, -86400001)).toThrow("Reloj inválido");

    // Desfase no entero o no finito.
    expect(() => horaEfectiva(baseIso, 1.5)).toThrow("Reloj inválido");
    expect(() => horaEfectiva(baseIso, NaN)).toThrow("Reloj inválido");
    expect(() => horaEfectiva("hora-invalida", 0)).toThrow("Reloj inválido");
  });

  test("RF-302: ventana horaria de misa y limites con tolerancia de diez minutos", () => {
    const ventana = ventanaDe(sesionMisa);
    // Misa habitual en Lima: 07:30 a 09:30 (12:30 a 14:30 UTC).
    // Con 10 minutos de tolerancia: inicio permitido desde 07:20:00 hasta 09:40:00 Lima.
    const dentroExactoLima = Date.parse("2026-10-11T08:00:00-05:00");
    const inicioPermitido = Date.parse("2026-10-11T07:20:00-05:00");
    const finPermitido = Date.parse("2026-10-11T09:40:00-05:00");
    const unSegundoAntes = Date.parse("2026-10-11T07:19:59-05:00");
    const unSegundoDespues = Date.parse("2026-10-11T09:40:01-05:00");

    expect(dentroDeVentana(dentroExactoLima, ventana)).toBe(true);
    expect(dentroDeVentana(inicioPermitido, ventana)).toBe(true);
    expect(dentroDeVentana(finPermitido, ventana)).toBe(true);

    // Fuera de tolerancia.
    expect(dentroDeVentana(unSegundoAntes, ventana)).toBe(false);
    expect(dentroDeVentana(unSegundoDespues, ventana)).toBe(false);
    expect(dentroDeVentana(NaN, ventana)).toBe(false);
  });

  test("RF-302: comparacion de instantes temporales y precision de microsegundos", () => {
    expect(compararInstantes("2026-10-11T08:00:00.000001Z", "2026-10-11T08:00:00.000002Z")).toBeLessThan(0);
    expect(compararInstantes("2026-10-11T08:00:00.100000Z", "2026-10-11T08:00:00.090000Z")).toBeGreaterThan(0);
    expect(() => compararInstantes("invalido", "2026-10-11T08:00:00Z")).toThrow("Instante inválido");
  });
});
