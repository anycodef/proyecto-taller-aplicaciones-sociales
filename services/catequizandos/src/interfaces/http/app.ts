import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import type { InscribirCatequizando, OrdenDeInscripcion } from "../../application/inscribir-catequizando";
import type { ListarCatequizandos } from "../../application/listar-catequizandos";
import type { ListarGrupos } from "../../application/listar-grupos";
import type { ObtenerCatequizando } from "../../application/obtener-catequizando";
import { ErrorDeValidacion, NoEncontrado } from "../../domain/errores";

export type CasosDeUso = {
  listarGrupos: ListarGrupos;
  listarCatequizandos: ListarCatequizandos;
  obtenerCatequizando: ObtenerCatequizando;
  inscribirCatequizando: InscribirCatequizando;
};

export type OpcionesApp = {
  /** CORS solo fuera de producción: en la nube lo maneja el gateway. */
  habilitarCors: boolean;
};

const NOMBRE_SERVICIO = "catequizandos";

const errorJson = (code: string, message: string) => ({ error: { code, message } });

export function crearApp(casos: CasosDeUso, opciones: OpcionesApp): Express {
  const app = express();
  app.disable("x-powered-by");
  if (opciones.habilitarCors) app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", servicio: NOMBRE_SERVICIO });
  });

  app.get("/grupos", async (_req, res) => {
    res.json(await casos.listarGrupos.ejecutar());
  });

  app.get("/catequizandos", async (req, res) => {
    const grupoId = typeof req.query.grupoId === "string" ? req.query.grupoId : undefined;
    res.json(await casos.listarCatequizandos.ejecutar({ grupoId }));
  });

  app.get("/catequizandos/:id", async (req, res) => {
    res.json(await casos.obtenerCatequizando.ejecutar(req.params.id));
  });

  app.post("/catequizandos", async (req, res) => {
    const cuerpo: unknown = req.body;
    if (cuerpo === null || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
      throw new ErrorDeValidacion("El cuerpo debe ser un objeto JSON");
    }
    // El controlador solo traduce HTTP; los tipos y valores reales los valida el dominio.
    const { grupoId, nombres, apellidos, fechaNacimiento, consentimiento } = cuerpo as OrdenDeInscripcion;
    const creado = await casos.inscribirCatequizando.ejecutar({
      grupoId,
      nombres,
      apellidos,
      fechaNacimiento,
      consentimiento,
    });
    res.status(201).json(creado);
  });

  app.use((_req, _res, next) => next(new NoEncontrado("Ruta no encontrada")));

  const manejarErrores: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ErrorDeValidacion) {
      res.status(400).json(errorJson(err.code, err.message));
    } else if (err instanceof NoEncontrado) {
      res.status(404).json(errorJson(err.code, err.message));
    } else if (err instanceof SyntaxError || (err as { type?: string })?.type === "entity.parse.failed") {
      res.status(400).json(errorJson("VALIDACION", "El cuerpo no es JSON válido"));
    } else {
      console.error(err);
      res.status(500).json(errorJson("ERROR_INTERNO", "Error interno del servidor"));
    }
  };
  app.use(manejarErrores);

  return app;
}
