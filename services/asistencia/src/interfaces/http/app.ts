import cors from "cors";
import express, { ErrorRequestHandler, Express, Request, RequestHandler } from "express";
import { CalcularRiesgo } from "../../application/CalcularRiesgo";
import { ObtenerHistorial } from "../../application/ObtenerHistorial";
import { PasarLista } from "../../application/PasarLista";
import { ErrorDeValidacion, ErrorNoEncontrado } from "../../domain/errores";
import { aDatosPaseDeLista } from "./cuerpoPaseDeLista";

export type CasosDeUso = {
  pasarLista: PasarLista;
  obtenerHistorial: ObtenerHistorial;
  calcularRiesgo: CalcularRiesgo;
};

export type OpcionesApp = {
  /** CORS solo fuera de producción: en la nube lo maneja el gateway (SPEC §3). */
  habilitarCors: boolean;
};

export const NOMBRE_SERVICIO = "asistencia";

function paramId(req: Request): string {
  const id = req.params["id"];
  return typeof id === "string" ? id : "";
}

export function crearApp(casosDeUso: CasosDeUso, opciones: OpcionesApp): Express {
  const app = express();
  app.disable("x-powered-by");
  if (opciones.habilitarCors) app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", servicio: NOMBRE_SERVICIO });
  });

  app.post("/pases-de-lista", async (req, res) => {
    const resultado = await casosDeUso.pasarLista.ejecutar(aDatosPaseDeLista(req.body));
    res.status(201).json(resultado);
  });

  app.get("/catequizandos/:id/registros", async (req, res) => {
    res.status(200).json(await casosDeUso.obtenerHistorial.ejecutar(paramId(req)));
  });

  app.get("/catequizandos/:id/riesgo", async (req, res) => {
    res.status(200).json(await casosDeUso.calcularRiesgo.ejecutar(paramId(req)));
  });

  const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
    next(new ErrorNoEncontrado(`No existe la ruta ${req.method} ${req.path}`));
  };
  app.use(rutaNoEncontrada);
  app.use(manejadorDeErrores);

  return app;
}

/** Traduce errores de dominio al error estándar del contrato: 400 / 404 (SPEC §3). */
const manejadorDeErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ErrorDeValidacion) {
    res.status(400).json({ error: { code: "VALIDACION", message: err.message } });
  } else if (err instanceof ErrorNoEncontrado) {
    res.status(404).json({ error: { code: "NO_ENCONTRADO", message: err.message } });
  } else if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "VALIDACION", message: "El cuerpo no es JSON válido" } });
  } else {
    console.error(err);
    res.status(500).json({ error: { code: "ERROR_INTERNO", message: "Error inesperado del servidor" } });
  }
};
