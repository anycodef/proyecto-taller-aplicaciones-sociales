import { MAXIMO_INTENTOS, planInicial, siguienteIntento, type IntentoCompresion } from "@/lib/justificaciones/compresion";
import { LIMITE_BYTES } from "@/lib/justificaciones/evidencia";

const pesado = LIMITE_BYTES + 1;

test("RNF-402: el plan inicial limita el lado mayor a 1600 px con calidad 0,7", () => {
  expect(planInicial(4000, 3000)).toMatchObject({ numero: 1, ancho: 1600, alto: 1200, calidad: 0.7 });
  expect(planInicial(3000, 4000)).toMatchObject({ ancho: 1200, alto: 1600 });
  expect(planInicial(800, 600)).toMatchObject({ ancho: 800, alto: 600 });
  expect(() => planInicial(0, 600)).toThrow("dimensiones_invalidas");
});

test("RNF-402: siguienteIntento baja la calidad a 0,55 y 0,4 y luego el lado a 1280 y 1024", () => {
  const vistos: Pick<IntentoCompresion, "calidad" | "ancho">[] = [];
  let actual = planInicial(4000, 3000);
  for (;;) {
    vistos.push({ calidad: actual.calidad, ancho: actual.ancho });
    const resultado = siguienteIntento(actual, pesado);
    if (resultado.tipo !== "reintentar") break;
    actual = resultado.intento;
  }
  expect(vistos).toEqual([
    { calidad: 0.7, ancho: 1600 },
    { calidad: 0.55, ancho: 1600 },
    { calidad: 0.4, ancho: 1600 },
    { calidad: 0.4, ancho: 1280 },
    { calidad: 0.4, ancho: 1024 },
  ]);
});

test("RNF-402: el plan de compresión termina bajo 300 KB o falla en 5 intentos", () => {
  const simular = (bytesPorIntento: (i: IntentoCompresion) => number) => {
    let actual = planInicial(4000, 3000);
    for (;;) {
      const resultado = siguienteIntento(actual, bytesPorIntento(actual));
      if (resultado.tipo !== "reintentar") return { resultado: resultado.tipo, intentos: actual.numero };
      actual = resultado.intento;
    }
  };
  expect(simular(i => (i.calidad >= 0.55 ? 500_000 : 250_000))).toEqual({ resultado: "listo", intentos: 3 });
  expect(simular(() => 200_000)).toEqual({ resultado: "listo", intentos: 1 });
  expect(simular(() => pesado)).toEqual({ resultado: "fallido", intentos: MAXIMO_INTENTOS });
});
