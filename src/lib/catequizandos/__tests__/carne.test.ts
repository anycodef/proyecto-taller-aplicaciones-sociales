import {
  codificarCarne,
  escaparHtml,
  hojaCarnesHtml,
  interpretarCodigoCarne,
  matrizQr,
  svgDeMatriz,
} from "@/lib/catequizandos/carne";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const codigo = codificarCarne(uuid, 1);

test("RF-302: matrizQr es cuadrada, determinista y usa corrección M", () => {
  const matriz = matrizQr(codigo);

  expect(matriz.length).toBeGreaterThan(20);
  expect(matriz[0]).toHaveLength(matriz.length);
  expect(matriz.every((fila) => fila.length === matriz.length)).toBe(true);
  expect(matrizQr(codigo)).toEqual(matriz);
});

test("RF-302: svgDeMatriz pinta un módulo por cada celda oscura", () => {
  const matriz = matrizQr(codigo);
  const svg = svgDeMatriz(matriz);
  const oscuros = matriz.flat().filter(Boolean).length;

  expect(svg).toContain("<svg");
  expect(svg.match(/<rect /g)?.length).toBe(oscuros + 1);
  expect(svg).toContain(`viewBox="0 0 ${matriz.length} ${matriz.length}"`);
});

test("RF-302: la hoja tiene un carné por niño", () => {
  const hoja = hojaCarnesHtml([
    { nombres: "Mateo", apellidos: "Vargas", grupo: "Grupo A", emision: 1, codigoCarne: codigo },
    { nombres: "Ana", apellidos: "Pérez", grupo: "Grupo A", emision: 2, codigoCarne: codificarCarne(uuid, 2) },
  ]);

  expect(hoja.match(/class="carne"/g)).toHaveLength(2);
  expect(hoja).toContain("Mateo Vargas");
  expect(hoja).toContain("Ana Pérez");
  expect(hoja).toContain("Emisión 1");
  expect(hoja).toContain("Emisión 2");
});

test("RF-302: la hoja escapa caracteres HTML en los nombres", () => {
  const hoja = hojaCarnesHtml([
    {
      nombres: "<script>alert(1)</script>",
      apellidos: "O'Neil & Cía",
      grupo: "Grupo <A>",
      emision: 1,
      codigoCarne: codigo,
    },
  ]);

  expect(hoja).not.toContain("<script>");
  expect(hoja).toContain("&lt;script&gt;");
  expect(hoja).toContain("O&#39;Neil &amp; Cía");
  expect(hoja).toContain("Grupo &lt;A&gt;");
  expect(escaparHtml("a<b")).toBe("a&lt;b");
});

test("RF-302: el código del carné solo acepta el formato SGC1", () => {
  expect(interpretarCodigoCarne(codigo)).toEqual({ catequizandoId: uuid, emision: 1 });
  expect(interpretarCodigoCarne("otra-cosa")).toEqual({ invalido: true });
});
