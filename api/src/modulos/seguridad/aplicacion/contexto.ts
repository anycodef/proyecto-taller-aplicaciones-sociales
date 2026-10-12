import type { HttpRequest } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { consultar } from "../../../compartido/bd/pool";
import type { Tx } from "../../../compartido/bd/transaccion";
import { verificarJwt, type IdentidadJwt } from "../infraestructura/firmador-jwt";
type FilaContexto = { cuenta_id: string; credencial_id: string; dispositivo_id: string | null; identidad_operativa: string; es_menor: boolean; roles: Rol[]; delegacion: { id: string; hasta: string } | null; grupos: string[]; hijos: string[] };
export async function cargarContexto(datos: IdentidadJwt, tx?: Tx): Promise<ContextoAcceso | null> {
  const sql = `SELECT c.id cuenta_id,cr.id credencial_id,cr.dispositivo_id,c.identidad_operativa,c.es_menor,
    ARRAY(SELECT rol FROM rol_cuenta WHERE cuenta_id=c.id ORDER BY rol) roles,
    (SELECT json_build_object('id',d.id,'hasta',d.hasta) FROM delegacion d JOIN cuenta delegante ON delegante.id=d.delegante_id
      WHERE d.delegado_id=c.id AND d.revocada_en IS NULL AND d.desde<=now() AND d.hasta>now() AND delegante.activa
      AND EXISTS(SELECT 1 FROM rol_cuenta r WHERE r.cuenta_id=delegante.id AND r.rol IN ('administracion','coordinacion'))
      AND EXISTS(SELECT 1 FROM rol_cuenta r WHERE r.cuenta_id=c.id AND r.rol='catequista') ORDER BY d.hasta DESC,d.id LIMIT 1) delegacion,
    ARRAY(SELECT DISTINCT gc.grupo_id FROM grupo_catequista gc JOIN grupo g ON g.id=gc.grupo_id JOIN ciclo ci ON ci.id=g.ciclo_id AND ci.estado='abierto' WHERE gc.cuenta_id=c.id AND gc.desde<=now() AND (gc.hasta IS NULL OR gc.hasta>now())) grupos,
    ARRAY(SELECT DISTINCT v.catequizando_id FROM vinculo_apoderado v JOIN apoderado a ON a.id=v.apoderado_id WHERE a.cuenta_id=c.id AND v.vigente_desde<=now() AND (v.vigente_hasta IS NULL OR v.vigente_hasta>now())) hijos
    FROM cuenta c JOIN credencial cr ON cr.cuenta_id=c.id
    WHERE c.id=$1 AND cr.id=$2 AND c.activa AND cr.estado='activa' AND cr.tipo=$3
    AND (cr.tipo='familia' OR cr.dispositivo_id=$4::uuid)`;
  const valores = [datos.cuentaId, datos.credencialId, datos.tipo, datos.dispositivoId ?? null];
  const resultado = tx ? await tx.query<FilaContexto>(sql, valores) : await consultar<FilaContexto>(sql, valores);
  const fila = resultado.rows[0];
  if (!fila || !fila.roles.length) return null;
  if (datos.tipo === "equipo" && !fila.roles.some(rol => rol !== "familia")) return null;
  if (datos.tipo === "familia" && (!fila.roles.includes("familia") || !fila.hijos.length)) return null;
  return { cuentaId: fila.cuenta_id, credencialId: fila.credencial_id, identidadOperativa: fila.identidad_operativa, esMenor: fila.es_menor, rolesPropios: fila.roles, gruposAsignados: fila.grupos, catequizandosApoderados: fila.hijos, ...(fila.dispositivo_id ? { dispositivoId: fila.dispositivo_id } : {}), ...(fila.delegacion ? { delegacionVigente: fila.delegacion } : {}) };
}
export async function autenticarPeticion(req: HttpRequest): Promise<ContextoAcceso | null> {
  const cabecera = req.headers.get("authorization");
  if (!cabecera || !/^Bearer \S+$/i.test(cabecera)) return null;
  const datos = await verificarJwt(cabecera.slice(7));
  return datos ? cargarContexto(datos) : null;
}
