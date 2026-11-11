import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import type { Falta } from "@/lib/asistencia/tipos";
import {
  evaluarRiesgo,
  ordenarListaRiesgo,
  type EstadoRiesgo,
  type FaltaClasificada,
  type Paso,
} from "@/lib/riesgo";
import type { Tx } from "../../../compartido/bd/transaccion";
import { consultarFaltas } from "../../asistencia/aplicacion/consultar-faltas";
import { obtenerFuenteInscripciones } from "../../asistencia/infraestructura/fuente-inscripciones-pg";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";

export type EntradaListaRiesgo = {
  catequizandoId: string;
  nombre: string;
  grupoId: string;
  grupoNombre: string;
  paso: Paso;
  conteo: number;
  sinFicha: boolean;
  pendientesJustificar: number;
  faltasOrigen: FaltaClasificada[];
};

const fechaLima = (ahora: Date): string =>
  new Date(ahora.getTime() - 5 * 3600000).toISOString().slice(0, 10);

function agruparFaltas(faltas: Falta[]): Map<string, Falta[]> {
  const porNino = new Map<string, Falta[]>();
  for (const falta of faltas) {
    porNino.set(falta.catequizandoId, [...(porNino.get(falta.catequizandoId) ?? []), falta]);
  }
  return porNino;
}

export async function consultarListaRiesgo(
  ctx: ContextoAcceso,
  ahora: Date,
  tx: Tx,
): Promise<EntradaListaRiesgo[]> {
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) return [];

  const activos = await obtenerFuenteInscripciones().activosEnFecha(cicloId, fechaLima(ahora), tx);
  const verTodos = rolesEfectivos(ctx).includes("coordinacion");
  const visibles = verTodos
    ? activos
    : activos.filter((nino) => ctx.gruposAsignados.includes(nino.grupoId));
  if (!visibles.length) return [];

  const faltas = agruparFaltas(await consultarFaltas(cicloId, { ahora: ahora.getTime() }, tx));
  const grupos = await tx.query<{ id: string; nombre: string }>(
    "SELECT id,nombre FROM grupo WHERE id=ANY($1::uuid[])",
    [[...new Set(visibles.map((nino) => nino.grupoId))]],
  );
  const nombreGrupo = new Map(grupos.rows.map((fila) => [fila.id, fila.nombre]));
  const porId = new Map(visibles.map((nino) => [nino.catequizandoId, nino]));

  const estados: EstadoRiesgo[] = visibles.map((nino) =>
    evaluarRiesgo(
      {
        catequizandoId: nino.catequizandoId,
        faltas: (faltas.get(nino.catequizandoId) ?? []).map((falta) => ({
          catequizandoId: falta.catequizandoId,
          fecha: falta.fecha,
          origen: falta.origen,
          sesionIds: falta.sesionIds,
          justificada: falta.justificada,
        })),
      },
      ahora,
    ),
  );

  return ordenarListaRiesgo(estados).flatMap((estado) => {
    const nino = porId.get(estado.catequizandoId);
    if (!nino) return [];
    return [
      {
        catequizandoId: estado.catequizandoId,
        nombre: nino.nombre,
        grupoId: nino.grupoId,
        grupoNombre: nombreGrupo.get(nino.grupoId) ?? "",
        paso: estado.paso,
        conteo: estado.conteo,
        sinFicha: estado.sinFicha,
        pendientesJustificar: estado.pendientesJustificar,
        faltasOrigen: estado.faltasOrigen,
      },
    ];
  });
}
