import { comprimirFoto, ErrorCompresion, PASOS_COMPRESION, type DependenciasCompresion } from "../comprimir-foto";

const LIMITE = 300 * 1024;
const blob = (bytes: number) => new Blob([new Uint8Array(bytes)]);

function doble(tamanos: number[]) {
  const borrados: string[] = [];
  const reducidos: { ancho: number; calidad: number }[] = [];
  let n = 0;
  const deps: DependenciasCompresion = {
    reducir: async (_uri, ancho, calidad) => {
      reducidos.push({ ancho, calidad });
      return `file:///tmp/paso-${++n}.jpg`;
    },
    leer: async (uri) => blob(tamanos[Number(uri.match(/paso-(\d+)/)![1]) - 1]),
    borrar: async (uri) => {
      borrados.push(uri);
    },
  };
  return { deps, borrados, reducidos };
}

test("RNF-402: devuelve el primer JPEG que cabe en 300 KB", async () => {
  const { deps, reducidos } = doble([LIMITE - 1]);
  const foto = await comprimirFoto("file:///camara/original.jpg", deps);
  expect(foto.bytes).toBe(LIMITE - 1);
  expect(reducidos).toEqual([PASOS_COMPRESION[0]]);
});

test("RNF-402: si pasa de 300 KB baja el ancho y la calidad hasta que cabe", async () => {
  const { deps, reducidos } = doble([LIMITE + 1, LIMITE + 10, 150_000]);
  const foto = await comprimirFoto("file:///camara/original.jpg", deps);
  expect(foto.bytes).toBe(150_000);
  expect(reducidos).toEqual(PASOS_COMPRESION.slice(0, 3));
  expect(reducidos[2].ancho).toBeLessThan(reducidos[0].ancho);
});

test("RNF-402: si ningún paso alcanza el límite falla en vez de enviar una foto grande", async () => {
  const { deps } = doble(PASOS_COMPRESION.map(() => LIMITE * 2));
  await expect(comprimirFoto("file:///camara/original.jpg", deps)).rejects.toBeInstanceOf(ErrorCompresion);
});

test("RNF-404: borra el original y todos los temporales intermedios, con éxito y con error", async () => {
  const exito = doble([LIMITE + 1, 1000]);
  await comprimirFoto("file:///camara/original.jpg", exito.deps);
  expect(exito.borrados.sort()).toEqual(["file:///camara/original.jpg", "file:///tmp/paso-1.jpg", "file:///tmp/paso-2.jpg"]);

  const fallo = doble(PASOS_COMPRESION.map(() => LIMITE * 2));
  await comprimirFoto("file:///camara/original.jpg", fallo.deps).catch(() => undefined);
  expect(fallo.borrados).toContain("file:///camara/original.jpg");
  expect(fallo.borrados).toHaveLength(PASOS_COMPRESION.length + 1);
});
