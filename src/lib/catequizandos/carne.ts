import generarQr from "qrcode-generator";

const formato = /^SGC1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([1-9][0-9]*)$/i;
export function interpretarCodigoCarne(texto: string): { catequizandoId: string; emision: number } | { invalido: true } {
  const partes = formato.exec(texto);
  if (!partes || partes[0] !== texto || !Number.isSafeInteger(Number(partes[2])) || Number(partes[2]) > 2147483647) return { invalido: true };
  return { catequizandoId: partes[1].toLowerCase(), emision: Number(partes[2]) };
}
export function codificarCarne(catequizandoId: string, emision: number): string {
  const codigo = `SGC1:${catequizandoId.toLowerCase()}:${emision}`;
  if ("invalido" in interpretarCodigoCarne(codigo)) throw new Error("carne_invalido");
  return codigo;
}

/**
 * Matriz del codigo QR: una fila por modulo, true donde el modulo es oscuro.
 * Se calcula en el dispositivo para que el carné se pueda pintar sin red.
 */
export function matrizQr(texto: string): boolean[][] {
  const codigo = generarQr(0, "M");
  codigo.addData(texto);
  codigo.make();

  const lado = codigo.getModuleCount();
  const matriz: boolean[][] = [];
  for (let fila = 0; fila < lado; fila += 1) {
    const modulos: boolean[] = [];
    for (let columna = 0; columna < lado; columna += 1) {
      modulos.push(codigo.isDark(fila, columna));
    }
    matriz.push(modulos);
  }
  return matriz;
}

/** SVG de la matriz, para la hoja imprimible. */
export function svgDeMatriz(matriz: boolean[][]): string {
  const lado = matriz.length;
  const modulos = matriz
    .flatMap((fila, y) =>
      fila.map((oscuro, x) => (oscuro ? `<rect x="${x}" y="${y}" width="1" height="1" />` : "")).join("")
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado * 4}" height="${lado * 4}" shape-rendering="crispEdges"><rect width="${lado}" height="${lado}" fill="#ffffff"/><g fill="#16241B">${modulos}</g></svg>`;
}

/** Escapa el texto que va dentro del HTML de la hoja. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type CarneParaHoja = {
  nombres: string;
  apellidos: string;
  grupo: string;
  emision: number;
  codigoCarne: string;
};

/** Hoja imprimible con un carné por niño. */
export function hojaCarnesHtml(carnes: CarneParaHoja[]): string {
  const tarjetas = carnes
    .map((carne) => {
      const svg = svgDeMatriz(matrizQr(carne.codigoCarne));
      return `<section class="carne"><p class="marca">SIGECAT · CARNÉ</p><h2>${escaparHtml(
        `${carne.nombres} ${carne.apellidos}`
      )}</h2><p class="grupo">${escaparHtml(carne.grupo)}</p><div class="qr">${svg}</div><p class="emision">Emisión ${
        carne.emision
      }</p></section>`;
    })
    .join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Carnés del grupo</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F3F5F2;color:#16241B;margin:0;padding:24px}
    h1{font-size:22px;margin:0 0 16px}
    .carne{background:#fff;border:1px solid #D5DCD7;border-radius:20px;padding:24px;margin:0 0 16px;page-break-inside:avoid;text-align:center}
    .marca{color:#1F6B4F;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin:0}
    h2{font-size:20px;margin:8px 0 4px}
    .grupo{color:#4B5B51;margin:0 0 12px}
    .qr svg{width:180px;height:180px}
    .emision{color:#4B5B51;font-size:14px}
  </style></head><body><h1>Carnés del grupo</h1>${tarjetas}</body></html>`;
}
