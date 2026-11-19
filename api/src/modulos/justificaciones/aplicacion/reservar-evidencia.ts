import { z } from "zod";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { MAXIMO_FOTOS, validarMetadatos } from "@/lib/justificaciones/evidencia";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { nombreBlob, type AlmacenEvidencias } from "../dominio/puertos";
import { repositorioEvidenciasPg as evidencias } from "../infraestructura/repositorio-evidencias-pg";

export const esquemaReserva = z.object({
  evidenciaId: z.string().uuid(),
  archivos: z.array(z.object({ orden: z.number().int(), bytes: z.number().int(), contentType: z.string().max(100) }).strict()).max(10),
}).strict();
export type EntradaReserva = z.infer<typeof esquemaReserva>;
export type Reserva = { evidenciaId: string; expiraEn: string; archivos: { orden: number; url: string }[] };

/** Valida los metadatos declarados; la inspección real del blob ocurre al crear el lote. */
export async function reservarEvidencia(entrada: EntradaReserva, ctx: ContextoAcceso, almacen: AlmacenEvidencias, ahora: Date, tx: Tx): Promise<Reserva> {
  const metadatos = validarMetadatos(entrada.archivos);
  if (!metadatos.valida) throw new ErrorAplicacion(400, metadatos.motivo);
  const ordenes = entrada.archivos.map(a => a.orden).sort((a, b) => a - b);
  if (ordenes.some((orden, i) => orden !== i + 1) || ordenes.length > MAXIMO_FOTOS) throw new ErrorAplicacion(400, "orden_invalido");
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  const existente = await evidencias.obtener(tx, entrada.evidenciaId);
  if (existente && (existente.subidaPor !== ctx.cuentaId || existente.estado !== "reservada" || existente.cicloId !== cicloId)) throw new ErrorAplicacion(409, "evidencia_en_uso");
  if (!existente) await evidencias.reservar(tx, { id: entrada.evidenciaId, cicloId, subidaPor: ctx.cuentaId, en: ahora });
  const archivos: Reserva["archivos"] = [];
  let expiraEn = "";
  for (const orden of ordenes) {
    const firmada = await almacen.urlSubida(nombreBlob(cicloId, entrada.evidenciaId, orden), ahora);
    archivos.push({ orden, url: firmada.url });
    expiraEn = firmada.expiraEn;
  }
  return { evidenciaId: entrada.evidenciaId, expiraEn, archivos };
}
