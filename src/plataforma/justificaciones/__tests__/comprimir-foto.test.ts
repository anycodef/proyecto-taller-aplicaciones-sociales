import { LIMITE_BYTES } from "@/lib/justificaciones/evidencia";
import { comprimirFoto, ErrorCompresion, type ArchivosTemporales, type Manipulador } from "@/plataforma/justificaciones/comprimir-foto";

jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));

function simulados(pesos: number[]) {
  const generadas: string[] = [];
  const borradas: string[] = [];
  const manipulador: Manipulador = {
    dimensiones: async () => ({ ancho: 4000, alto: 3000 }),
    comprimir: async (_uri, intento) => {
      const uri = `file:///cache/intento-${intento.numero}.jpg`;
      generadas.push(uri);
      return { uri, ancho: intento.ancho, alto: intento.alto };
    },
  };
  const archivos: ArchivosTemporales = {
    medir: async uri => pesos[generadas.indexOf(uri)] ?? LIMITE_BYTES * 2,
    borrar: async uri => { borradas.push(uri); },
  };
  return { manipulador, archivos, generadas, borradas };
}
const origen = { uri: "file:///cache/original.jpg", ancho: 4000, alto: 3000 };

test("RNF-402: comprime de forma iterativa hasta quedar bajo 300 KB", async () => {
  const { manipulador, archivos, generadas } = simulados([900_000, 500_000, 250_000]);
  const foto = await comprimirFoto(origen, manipulador, archivos);
  expect(foto).toEqual({ uri: "file:///cache/intento-3.jpg", ancho: 1600, alto: 1200, bytes: 250_000 });
  expect(generadas).toHaveLength(3);
});

test("RNF-402: falla con aviso tras 5 intentos", async () => {
  const { manipulador, archivos, generadas } = simulados([]);
  await expect(comprimirFoto(origen, manipulador, archivos)).rejects.toBeInstanceOf(ErrorCompresion);
  expect(generadas).toHaveLength(5);
});

test("RNF-404: borra los archivos intermedios", async () => {
  const exito = simulados([900_000, 250_000]);
  await comprimirFoto(origen, exito.manipulador, exito.archivos);
  expect(exito.borradas).toEqual(["file:///cache/intento-1.jpg"]);
  const fallo = simulados([]);
  await expect(comprimirFoto(origen, fallo.manipulador, fallo.archivos)).rejects.toThrow("foto_muy_pesada");
  expect(fallo.borradas).toEqual(fallo.generadas);
});

test("RNF-402: sin dimensiones del picker las mide antes de planificar", async () => {
  const { manipulador, archivos } = simulados([200_000]);
  const foto = await comprimirFoto({ uri: origen.uri, ancho: 0, alto: 0 }, manipulador, archivos);
  expect(foto).toMatchObject({ ancho: 1600, alto: 1200 });
});
