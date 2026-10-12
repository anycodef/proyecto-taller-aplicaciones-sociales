import { app, InvocationContext, type TimerFunctionOptions } from "@azure/functions";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { crearEsquema, bootstrap } from "./soporte";

let pool: Pool;
jest.mock("../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (sql: string, parametros: unknown[]) => pool.query(sql, parametros) }));
jest.mock("@azure/functions", () => ({ ...jest.requireActual("@azure/functions"), app: { http: jest.fn(), timer: jest.fn() } }));

test("RF-108 RF-307: depurarMetadatos del index real elimina metadatos vencidos con permisos API y mantiene los vigentes", async () => {
  const bd = await crearEsquema(); pool = bd.api;
  const clave = process.env.JWT_CLAVE; process.env.JWT_CLAVE = "clave-local-depuracion-e2e-sin-uso-produccion";
  try {
    const admin = await bootstrap(bd.administracion), cicloId = randomUUID(), lapidaVieja = randomUUID(), lapidaVigente = randomUUID();
    await bd.administracion.query("INSERT INTO ciclo(id,nombre,inicio,fin,estado,abierto_por) VALUES($1,'Depuración E2E','2026-01-01','2026-12-31','abierto',$2)", [cicloId, admin.contexto.cuentaId]);
    await bd.administracion.query("BEGIN; SET LOCAL ROLE sigecat_retencion; SET LOCAL sigecat.contexto='retencion'");
    await bd.administracion.query("INSERT INTO lapida_sincronizacion(tabla,fila_id,ciclo_id,eliminado_en) VALUES('asistencias',$1,$3,now()-interval '61 days'),('asistencias',$2,$3,now())", [lapidaVieja, lapidaVigente, cicloId]);
    await bd.administracion.query("COMMIT");
    await bd.administracion.query("INSERT INTO contador_limite(cuenta_id,operacion,ventana,cantidad) VALUES($1,'viejo',floor(extract(epoch FROM now()-interval '2 days')/60)::bigint,1),($1,'vigente',floor(extract(epoch FROM now())/60)::bigint,1)", [admin.contexto.cuentaId]);
    const ninoId = randomUUID();
    await bd.administracion.query("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,'Depuración','E2E','2016-01-01','femenino',false,$2)", [ninoId, admin.contexto.cuentaId]);
    await bd.administracion.query("INSERT INTO referencia_duplicado(id,cuenta_id,catequizando_id,clave_duplicado,vence_en) VALUES($1,$3,$4,'vieja',now()-interval '1 hour'),($2,$3,$4,'vigente',now()+interval '1 hour')", [randomUUID(), randomUUID(), admin.contexto.cuentaId, ninoId]);
    jest.requireActual("../../src/index");
    const timer = (jest.mocked(app.timer).mock.calls as [string, TimerFunctionOptions][]).find(([nombre]) => nombre === "depurarMetadatos")?.[1];
    expect(timer).toBeDefined();
    await timer!.handler({ isPastDue: false, schedule: { adjustForDST: false }, scheduleStatus: { last: "2026-10-10T09:30:00Z", next: "2026-10-12T09:30:00Z", lastUpdated: "2026-10-11T09:30:00Z" } }, new InvocationContext({ functionName: "depurarMetadatos" }));
    expect((await bd.administracion.query("SELECT fila_id FROM lapida_sincronizacion")).rows).toEqual([{ fila_id: lapidaVigente }]);
    expect((await bd.administracion.query("SELECT operacion FROM contador_limite")).rows).toEqual([{ operacion: "vigente" }]);
    expect((await bd.administracion.query("SELECT clave_duplicado FROM referencia_duplicado")).rows).toEqual([{ clave_duplicado: "vigente" }]);
    expect((await pool.query("SELECT current_user AS rol,current_setting('sigecat.contexto',true) AS contexto")).rows[0].rol).toBe("sigecat_api");
  } finally {
    if (clave === undefined) delete process.env.JWT_CLAVE; else process.env.JWT_CLAVE = clave;
    await pool.end();
    try { await bd.administracion.query(`DROP SCHEMA IF EXISTS ${bd.esquema} CASCADE`); } finally { await bd.administracion.end(); }
  }
});
