import { crearEjecutorGraphql } from "./cliente-graphql.js";
import { conectarServidorStdio } from "./servidor.js";

await conectarServidorStdio(crearEjecutorGraphql());
