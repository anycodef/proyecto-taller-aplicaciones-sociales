import type { RecursoAlcance } from "@/lib/seguridad/contexto-acceso";
import { consultar } from "../bd/pool";

export async function recursoCatequizando(catequizandoId: string): Promise<RecursoAlcance> {
  const resultado = await consultar<{ grupo_id: string }>("SELECT a.grupo_id FROM asignacion_grupo a JOIN inscripcion i ON i.id=a.inscripcion_id JOIN ciclo c ON c.id=i.ciclo_id AND c.estado='abierto' WHERE i.catequizando_id=$1 AND i.estado='vigente' AND i.desde<=now() AND (i.hasta IS NULL OR i.hasta>now()) AND a.desde<=now() AND (a.hasta IS NULL OR a.hasta>now()) LIMIT 1", [catequizandoId]);
  return { catequizandoId, grupoId: resultado.rows[0]?.grupo_id };
}
export async function recursoInscripcion(inscripcionId: string): Promise<RecursoAlcance> {
  const resultado = await consultar<{ catequizando_id: string }>("SELECT catequizando_id FROM inscripcion WHERE id=$1", [inscripcionId]);
  const id = resultado.rows[0]?.catequizando_id;
  return id ? recursoCatequizando(id) : { catequizandoId: inscripcionId };
}
