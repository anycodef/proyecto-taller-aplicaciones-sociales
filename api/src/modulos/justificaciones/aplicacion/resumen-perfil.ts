import { estadoVisible } from "@/lib/justificaciones/estados";
import type { Tx } from "../../../compartido/bd/transaccion";
import type { ProveedorResumenPerfil } from "../../catequizandos/dominio/puertos";
import { repositorioJustificacionesPg } from "../infraestructura/repositorio-justificaciones-pg";

/**
 * Bloque del perfil de 002: el mismo contenido que `justificaciones_estado`, sin causa, motivo,
 * quién envió ni evidencia. El detalle y la evidencia se piden aparte y con conexión (RF-410, RNF-405).
 */
export const proveedorResumenJustificaciones: ProveedorResumenPerfil = {
  nombre: "resumenJustificaciones",
  async consultar(catequizandoId: string, cicloId: string, _contexto, tx: Tx) {
    const propias = (await repositorioJustificacionesPg.listarPorCatequizando(tx, catequizandoId)).filter(j => j.cicloId === cicloId);
    return { estados: propias.map(j => ({ id: j.id, sesionId: j.sesionId, fecha: j.fecha, tipoSesion: j.tipoSesion, estado: estadoVisible(j) })) };
  },
};
