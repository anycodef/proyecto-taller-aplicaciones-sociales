import { enTransaccion, type Tx } from "../src/compartido/bd/transaccion";
import { cerrarPool } from "../src/compartido/bd/pool";
import { emitirEnlace } from "../src/modulos/seguridad/aplicacion/cuentas";
import { construirUrlEnlace } from "@/lib/seguridad/enlaces";

class ErrorReemision extends Error {}

export async function reemitirAdministracion(tx: Tx, cuentaId?: string): Promise<{ cuentaId: string; url: string }> {
  if (cuentaId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cuentaId)) {
    throw new ErrorReemision("El argumento cuentaId debe ser un UUID válido");
  }
  construirUrlEnlace(process.env.URL_WEB ?? process.env.WEB_URL ?? "", "equipo", "validacion");
  await tx.query("SELECT pg_advisory_xact_lock(1001)");
  const resultado = await tx.query<{ id: string }>(
    "SELECT c.id FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id WHERE c.activa AND r.rol='administracion' AND ($1::uuid IS NULL OR c.id=$1::uuid) ORDER BY c.id FOR UPDATE OF c",
    [cuentaId ?? null],
  );
  if (!resultado.rows.length) {
    throw new ErrorReemision(cuentaId ? "La cuenta indicada no es una administración activa" : "No hay administración activa; ejecuta crear:administracion");
  }
  if (resultado.rows.length > 1) {
    throw new ErrorReemision("Hay varias administraciones activas; indica el cuentaId: npm --prefix api run reemitir:administracion -- <cuentaId>");
  }
  const id = resultado.rows[0].id;
  const enlace = await emitirEnlace(id, "equipo", tx);
  return { cuentaId: id, url: enlace.url };
}

if (require.main === module) {
  process.env.BD_URL = process.env.BD_MIGRACIONES_URL ?? process.env.BD_URL;
  console.info("La reemisión invalida las credenciales anteriores de equipo de la cuenta seleccionada");
  enTransaccion(tx => reemitirAdministracion(tx, process.argv[2]))
    .then(resultado => console.info(JSON.stringify(resultado)))
    .catch((error: unknown) => {
      console.error(error instanceof ErrorReemision ? error.message : "No se pudo reemitir el enlace; comprobar BD_MIGRACIONES_URL, URL_WEB, firewall y privilegios");
      process.exitCode = 1;
    })
    .finally(cerrarPool);
}
