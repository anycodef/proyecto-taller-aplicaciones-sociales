export { registrarJustificaciones, manejadoresJustificaciones } from "./http";
export { configurarAlmacenEvidencias } from "./infraestructura/almacen";
export { participanteRetencionJustificaciones } from "./aplicacion/depurar-evidencias";
export { repositorioEvidenciasPg } from "./infraestructura/repositorio-evidencias-pg";
export { repositorioJustificacionesPg } from "./infraestructura/repositorio-justificaciones-pg";
export type { AlmacenEvidencias, RepositorioEvidencias, RepositorioJustificaciones } from "./dominio/puertos";
