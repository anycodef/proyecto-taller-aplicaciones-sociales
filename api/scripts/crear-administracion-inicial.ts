import { randomUUID } from "node:crypto";
import { enTransaccion, type Tx } from "../src/compartido/bd/transaccion";
import { cerrarPool } from "../src/compartido/bd/pool";
import { emitirEnlace } from "../src/modulos/seguridad/aplicacion/cuentas";

export async function crearAdministracionInicial(tx: Tx, identidadOperativa: string): Promise<{ cuentaId: string; url: string } | null> {
  if (!identidadOperativa.trim() || identidadOperativa.length > 150) throw new Error("Identidad operativa inválida");
  await tx.query("SELECT pg_advisory_xact_lock(1001)");
  if ((await tx.query("SELECT c.id FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id WHERE r.rol='administracion' AND c.activa")).rowCount) return null;
  const cuentaId = randomUUID();
  await tx.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,$2,false)", [cuentaId, identidadOperativa.trim()]);
  await tx.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'administracion')", [cuentaId]);
  const enlace = await emitirEnlace(cuentaId, "equipo", tx);
  return { cuentaId, url: enlace.url };
}
if (require.main === module) {
  process.env.BD_URL = process.env.BD_MIGRACIONES_URL ?? process.env.BD_URL;
  enTransaccion(tx => crearAdministracionInicial(tx, process.argv[2] ?? "Administración inicial"))
    .then(resultado => console.info(resultado ? JSON.stringify(resultado) : "Ya existe administración activa; no se reemite su enlace"))
    .catch(() => { console.error("No se pudo crear administración inicial; comprobar configuración y privilegios"); process.exitCode = 1; })
    .finally(cerrarPool);
}
