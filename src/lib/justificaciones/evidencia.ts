/** 300 KB por foto (RNF-402); coincide con el check de evidencia_archivos. */
export const LIMITE_BYTES = 300 * 1024;
export const CONTENT_TYPE_EVIDENCIA = "image/jpeg";
export const MINIMO_FOTOS = 1;
/** Supuesto A-06: hasta 3 imágenes por evidencia, sin PDF. */
export const MAXIMO_FOTOS = 3;

export type ArchivoEvidencia = { contentType: string; bytes: number };
export type MotivoEvidenciaInvalida = "cantidad_fotos" | "tipo_no_permitido" | "tamano_invalido";
export type ResultadoEvidencia = { valida: true } | { valida: false; motivo: MotivoEvidenciaInvalida };

export function validarMetadatos(archivos: readonly ArchivoEvidencia[]): ResultadoEvidencia {
  if (archivos.length < MINIMO_FOTOS || archivos.length > MAXIMO_FOTOS) return { valida: false, motivo: "cantidad_fotos" };
  for (const archivo of archivos) {
    if (archivo.contentType !== CONTENT_TYPE_EVIDENCIA) return { valida: false, motivo: "tipo_no_permitido" };
    if (!Number.isInteger(archivo.bytes) || archivo.bytes <= 0 || archivo.bytes > LIMITE_BYTES) return { valida: false, motivo: "tamano_invalido" };
  }
  return { valida: true };
}

/** Los JPEG empiezan con FF D8 FF; el content-type declarado no basta (RNF-402). */
export function tieneFirmaJpeg(inicio: Uint8Array): boolean {
  return inicio.length >= 3 && inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff;
}
