import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import type { ClienteJustificaciones, RespuestaLote } from "@/lib/justificaciones/cliente-justificaciones";
import type { AusenciaRef, Causa } from "@/lib/justificaciones/tipos";

import { archivosExpo, comprimirFoto, ErrorCompresion, type ArchivosTemporales, type FotoComprimida, type ImagenLocal, type Manipulador } from "./comprimir-foto";

export const MENSAJE_SIN_ENVIO = "No se envió. Sin conexión: vuelve a intentarlo cuando tengas señal.";
export const MENSAJE_FOTO_PESADA = "No se envió. La foto pesa demasiado: toma otra más cerca del comprobante.";

export class ErrorEnvio extends Error {
  constructor(readonly codigo: string, readonly mensajeVisible: string) {
    super(codigo);
    this.name = "ErrorEnvio";
  }
}

/**
 * Ids nacidos en el cliente y guardados solo en la memoria de la pantalla:
 * un reintento manual reutiliza los mismos y el servidor no duplica (D-413).
 */
export type Borrador = { evidenciaId: string; loteId: string; justificaciones: Record<string, string>; intentos: number };
const clave = (a: Pick<AusenciaRef, "catequizandoId" | "sesionId">) => `${a.catequizandoId}|${a.sesionId}`;

export function crearBorrador(generarId: () => string = Crypto.randomUUID): Borrador {
  return { evidenciaId: generarId(), loteId: generarId(), justificaciones: {}, intentos: 0 };
}

function idsDe(borrador: Borrador, ausencias: readonly AusenciaRef[], generarId: () => string): Record<string, string> {
  const ids = { ...borrador.justificaciones };
  for (const a of ausencias) ids[clave(a)] ??= generarId();
  return ids;
}

export type Subidor = (url: string, foto: FotoComprimida) => Promise<void>;

/** PUT directo a Blob con la SAS; el contenido no pasa por la Function (D-402). */
export const subirConFetch: Subidor = async (url, foto) => {
  // En el celular el Blob de React Native no viaja como cuerpo del fetch de Expo: llegaban 14 bytes y el servidor rechazaba la foto.
  const cuerpo = Platform.OS === "web" ? await (await fetch(foto.uri)).blob() : new Uint8Array(await new File(foto.uri).arrayBuffer());
  const respuesta = await fetch(url, { method: "PUT", body: cuerpo, headers: { "x-ms-blob-type": "BlockBlob", "content-type": "image/jpeg" } });
  if (!respuesta.ok) throw new ErrorEnvio(`subida_${respuesta.status}`, MENSAJE_SIN_ENVIO);
};

export type DependenciasEnvio = {
  cliente: ClienteJustificaciones;
  conectado?: () => Promise<boolean>;
  subir?: Subidor;
  manipulador?: Manipulador;
  archivos?: ArchivosTemporales;
  generarId?: () => string;
};
/** apoderadoId solo cuando la coordinación registra en nombre de un apoderado (RF-406). */
export type EntradaEnvio = { borrador: Borrador; causa: Causa; ausencias: (AusenciaRef & { anticipada?: boolean })[]; fotos: ImagenLocal[]; apoderadoId?: string };
export type ResultadoEnvio = { borrador: Borrador; lote: RespuestaLote };

const hayConexion = async () => (await NetInfo.fetch()).isConnected !== false;

/**
 * Comprime, reserva, sube cada foto con su SAS y crea el lote, solo con conexión.
 * Pase lo que pase, borra la foto original y las comprimidas: nada queda en cola ni en el celular (RNF-404).
 */
export async function enviarJustificacion(entrada: EntradaEnvio, dependencias: DependenciasEnvio): Promise<ResultadoEnvio> {
  const { cliente, conectado = hayConexion, subir = subirConFetch, archivos = archivosExpo, generarId = Crypto.randomUUID } = dependencias;
  const borrador: Borrador = { ...entrada.borrador, justificaciones: idsDe(entrada.borrador, entrada.ausencias, generarId), intentos: entrada.borrador.intentos + 1 };
  const temporales = entrada.fotos.map(f => f.uri);
  try {
    if (!(await conectado())) throw new ErrorEnvio("sin_conexion", MENSAJE_SIN_ENVIO);
    const comprimidas: FotoComprimida[] = [];
    for (const foto of entrada.fotos) {
      const comprimida = await comprimirFoto(foto, dependencias.manipulador, archivos);
      temporales.push(comprimida.uri);
      comprimidas.push(comprimida);
    }
    const reserva = await cliente.reservarEvidencia(borrador.evidenciaId, comprimidas.map((f, i) => ({ orden: i + 1, bytes: f.bytes, contentType: "image/jpeg" })));
    for (const archivo of reserva.archivos) {
      try {
        await subir(archivo.url, comprimidas[archivo.orden - 1]);
      } catch (fallo) {
        // En un reintento la foto pudo subirse antes: la SAS solo crea, y el servidor verifica cada blob al crear el lote.
        if (entrada.borrador.intentos === 0) throw fallo;
      }
    }
    const lote = await cliente.crearLote({
      loteId: borrador.loteId,
      evidenciaId: borrador.evidenciaId,
      causa: entrada.causa,
      ...(entrada.apoderadoId ? { apoderadoId: entrada.apoderadoId } : {}),
      ausencias: entrada.ausencias.map(a => ({ justificacionId: borrador.justificaciones[clave(a)], catequizandoId: a.catequizandoId, sesionId: a.sesionId, anticipada: a.anticipada ?? false })),
    });
    return { borrador, lote };
  } catch (fallo) {
    if (fallo instanceof ErrorEnvio) throw Object.assign(fallo, { borrador });
    if (fallo instanceof ErrorCompresion) throw Object.assign(new ErrorEnvio("foto_muy_pesada", MENSAJE_FOTO_PESADA), { borrador });
    const codigo = fallo && typeof fallo === "object" && "codigo" in fallo ? String((fallo as { codigo: unknown }).codigo) : "envio_fallido";
    throw Object.assign(new ErrorEnvio(codigo, MENSAJE_SIN_ENVIO), { borrador });
  } finally {
    for (const uri of temporales) await archivos.borrar(uri);
  }
}
