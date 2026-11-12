import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

import { planInicial, siguienteIntento, type IntentoCompresion } from "@/lib/justificaciones/compresion";

export type ImagenLocal = { uri: string; ancho: number; alto: number };
export type FotoComprimida = ImagenLocal & { bytes: number };

export type Manipulador = {
  dimensiones(uri: string): Promise<{ ancho: number; alto: number }>;
  comprimir(uri: string, intento: IntentoCompresion): Promise<ImagenLocal>;
};
/** Archivos temporales del picker y del manipulador; nunca se conservan (RNF-404). */
export type ArchivosTemporales = { medir(uri: string): Promise<number>; borrar(uri: string): Promise<void> };

export class ErrorCompresion extends Error {
  constructor() {
    super("foto_muy_pesada");
    this.name = "ErrorCompresion";
  }
}

export const manipuladorExpo: Manipulador = {
  async dimensiones(uri) {
    const imagen = await ImageManipulator.manipulate(uri).renderAsync();
    return { ancho: imagen.width, alto: imagen.height };
  },
  async comprimir(uri, intento) {
    const contexto = ImageManipulator.manipulate(uri);
    contexto.resize({ width: intento.ancho, height: intento.alto });
    const imagen = await contexto.renderAsync();
    const guardada = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: intento.calidad });
    return { uri: guardada.uri, ancho: guardada.width, alto: guardada.height };
  },
};

/** expo-file-system no documenta web: allí las imágenes son URL de objeto que se revocan. */
export const archivosExpo: ArchivosTemporales = {
  async medir(uri) {
    if (Platform.OS === "web") return (await (await fetch(uri)).blob()).size;
    return new File(uri).size;
  },
  async borrar(uri) {
    try {
      if (Platform.OS === "web") {
        if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
        return;
      }
      const archivo = new File(uri);
      if (archivo.exists) archivo.delete();
    } catch {
      // Un temporal que ya no existe no es un fallo del envío.
    }
  },
};

/** Recomprime hasta quedar en 300 KB o falla al quinto intento; borra cada intermedio descartado. */
export async function comprimirFoto(origen: ImagenLocal, manipulador: Manipulador = manipuladorExpo, archivos: ArchivosTemporales = archivosExpo): Promise<FotoComprimida> {
  const medidas = origen.ancho > 0 && origen.alto > 0 ? origen : { ...origen, ...(await manipulador.dimensiones(origen.uri)) };
  let intento = planInicial(medidas.ancho, medidas.alto);
  for (;;) {
    const resultado = await manipulador.comprimir(origen.uri, intento);
    const bytes = await archivos.medir(resultado.uri);
    const siguiente = siguienteIntento(intento, bytes);
    if (siguiente.tipo === "listo") return { ...resultado, bytes };
    await archivos.borrar(resultado.uri);
    if (siguiente.tipo === "fallido") throw new ErrorCompresion();
    intento = siguiente.intento;
  }
}
