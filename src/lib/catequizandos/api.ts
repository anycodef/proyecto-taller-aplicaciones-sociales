import type { PeticionInscripcion, RespuestaInscripcion, Carne } from "./contratos";
export type ClienteHttp = { solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> };
export function crearApiCatequizandos(cliente: ClienteHttp) {
  return {
    inscribir: (datos: PeticionInscripcion) => cliente.solicitar<RespuestaInscripcion>("POST", "/inscripciones", datos),
    confirmarDuplicado: (referencia: string, esElMismo: boolean) => cliente.solicitar("POST", "/inscripciones/duplicados/confirmar", { referencia, esElMismo }),
    consultarPerfil: (id: string) => cliente.solicitar("GET", `/catequizandos/${encodeURIComponent(id)}/perfil`),
    consultarDocumentos: (id: string) => cliente.solicitar("GET", `/inscripciones/${encodeURIComponent(id)}/documentos`),
    consultarCarne: (id: string) => cliente.solicitar<Carne>("GET", `/catequizandos/${encodeURIComponent(id)}/carne`),
    reemitirCarne: (id: string, emisionEsperada: number) => cliente.solicitar<Carne>("POST", `/catequizandos/${encodeURIComponent(id)}/carne/reemitir`, { emisionEsperada }),
    buscarApoderados: (consulta: string) => cliente.solicitar("GET", `/apoderados?q=${encodeURIComponent(consulta)}`)
  };
}
