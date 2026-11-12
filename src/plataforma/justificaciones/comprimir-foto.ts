import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { LIMITE_BYTES } from "@/lib/justificaciones/evidencia";
import type { FotoComprimida } from "@/lib/justificaciones/enviar-justificacion";

/** Anchos y calidades que se prueban de mayor a menor hasta quedar por debajo de 300 KB (RNF-402). */
export const PASOS_COMPRESION: readonly { ancho: number; calidad: number }[] = [
  { ancho: 1280, calidad: 0.7 },
  { ancho: 1024, calidad: 0.6 },
  { ancho: 800, calidad: 0.5 },
  { ancho: 640, calidad: 0.4 },
];

export type DependenciasCompresion = {
  /** Reduce la imagen y devuelve la ruta del JPEG resultante. */
  reducir(uri: string, ancho: number, calidad: number): Promise<string>;
  /** Lee el archivo resultante como binario. */
  leer(uri: string): Promise<Blob>;
  /** Borra un archivo temporal; los fallos se ignoran porque no hay nada que reintentar (RNF-404). */
  borrar(uri: string): Promise<void>;
};

export class ErrorCompresion extends Error {
  constructor() {
    super("foto_demasiado_grande");
    this.name = "ErrorCompresion";
  }
}

const dependenciasExpo: DependenciasCompresion = {
  async reducir(uri, ancho, calidad) {
    const referencia = await ImageManipulator.manipulate(uri).resize({ width: ancho }).renderAsync();
    return (await referencia.saveAsync({ format: SaveFormat.JPEG, compress: calidad })).uri;
  },
  async leer(uri) {
    return (await fetch(uri)).blob();
  },
  async borrar(uri) {
    // En web las rutas son blob: o data: y las libera el navegador; solo se borran archivos locales.
    if (!uri.startsWith("file:")) return;
    try {
      new File(uri).delete();
    } catch {
      /* el temporal ya no existe */
    }
  },
};

/**
 * Convierte la foto elegida en un JPEG de menos de 300 KB. Borra todo temporal intermedio y también el
 * original que dejó la cámara; el resultado vive solo en memoria hasta que se envía (RNF-402, RNF-404).
 */
export async function comprimirFoto(uriOriginal: string, deps: DependenciasCompresion = dependenciasExpo): Promise<FotoComprimida> {
  const temporales: string[] = [uriOriginal];
  try {
    for (const { ancho, calidad } of PASOS_COMPRESION) {
      const uri = await deps.reducir(uriOriginal, ancho, calidad);
      temporales.push(uri);
      const datos = await deps.leer(uri);
      if (datos.size > 0 && datos.size <= LIMITE_BYTES) return { datos, bytes: datos.size };
    }
    throw new ErrorCompresion();
  } finally {
    await Promise.all(temporales.map((uri) => deps.borrar(uri)));
  }
}
