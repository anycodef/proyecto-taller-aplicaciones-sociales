import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HttpFunctionOptions, TimerFunctionOptions } from "@azure/functions";
import { app } from "@azure/functions";
import * as retencion from "../../src/modulos/seguridad/aplicacion/motor-retencion";
import * as resumenes from "../../src/modulos/catequizandos/dominio/puertos";
import * as bd from "../../src/compartido/bd/pool";

jest.mock("@azure/functions", () => ({ ...jest.requireActual("@azure/functions"), app: { http: jest.fn(), timer: jest.fn() } }));
jest.mock("../../src/compartido/bd/pool", () => ({ obtenerPool: jest.fn(() => { throw new Error("BD durante arranque"); }), consultar: jest.fn(() => { throw new Error("SQL durante arranque"); }) }));

test("RF-101 RF-106 RF-201 RF-307: el arranque real registra 65 bindings protegidos, contratos completos y proveedores sin secretos ni SQL", () => {
  const variables = ["BD_URL", "JWT_CLAVE", "BLOBS_CONEXION", "URL_WEB"];
  const anteriores = variables.map(nombre => process.env[nombre]);
  const orden: string[] = [];
  const original = retencion.registrarParticipanteRetencion;
  const registrar = jest.spyOn(retencion, "registrarParticipanteRetencion").mockImplementation(participante => { orden.push(participante.nombre); original(participante); });
  const resumen = jest.spyOn(resumenes, "registrarProveedorResumen");
  try {
    for (const nombre of variables) delete process.env[nombre];
    expect(() => jest.requireActual("../../src/index")).not.toThrow();
    const http = jest.mocked(app.http).mock.calls as [string, HttpFunctionOptions][];
    expect(http).toHaveLength(65);
    expect(new Set(http.map(([nombre]) => nombre)).size).toBe(http.length);
    for (const [, opciones] of http) {
      expect(opciones.authLevel).toBe("function");
      expect(typeof opciones.handler).toBe("function");
    }
    const documento = JSON.parse(readFileSync(resolve(__dirname, "../../openapi.json"), "utf8")) as { paths: Record<string, Record<string, unknown>> };
    const metodos = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
    const contratos = Object.entries(documento.paths).flatMap(([ruta, operaciones]) => Object.keys(operaciones).filter(metodo => metodos.has(metodo)).map(metodo => `${metodo.toUpperCase()} ${ruta}`)).sort();
    const bindings = http.flatMap(([, opciones]) => opciones.methods!.map(metodo => `${metodo} /${opciones.route}`)).sort();
    expect(bindings).toEqual(contratos);
    expect(orden).toEqual(["asistencia", "catequizandos", "seguridad", "avisos"]);
    expect(resumen).toHaveBeenCalledWith(expect.objectContaining({ nombre: "resumenAsistencia", consultar: expect.any(Function) }));
    const timers = jest.mocked(app.timer).mock.calls as [string, TimerFunctionOptions][];
    expect(timers.map(([nombre]) => nombre).sort()).toEqual(["borradosPendientes", "depurarMetadatos", "generarSesionesDominicales", "precalentarDomingo", "purgaAuditoria", "retencionDiaria"]);
    expect(timers.find(([nombre]) => nombre === "depurarMetadatos")?.[1].schedule).toBe("0 30 9 * * *");
    expect(bd.obtenerPool).not.toHaveBeenCalled();
    expect(bd.consultar).not.toHaveBeenCalled();
  } finally {
    registrar.mockRestore(); resumen.mockRestore();
    variables.forEach((nombre, indice) => { if (anteriores[indice] === undefined) delete process.env[nombre]; else process.env[nombre] = anteriores[indice]; });
  }
});
