import type { Grupo } from "./modelo";
import type { Carne, PeticionInscripcion, RespuestaInscripcion } from "./contratos";

export type ClienteHttp = { solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> };

/** Grupo como lo devuelve la API, con el total de ninos y el aviso de catequista. */
export type GrupoApi = Grupo & { total: number; sinCatequista: boolean };

export type CicloAbierto = {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: "abierto" | "cerrado";
};

/**
 * Id por defecto del cliente. La plataforma inyecta el de expo-crypto; en
 * Node y en el navegador sirve el estandar, que tambien genera UUID v4.
 */
function idPorDefecto(): string {
  const global = globalThis as { crypto?: { randomUUID?: () => string } };
  if (global.crypto?.randomUUID) return global.crypto.randomUUID();
  throw new Error("sin_generador_de_uuid");
}

/**
 * Prepara el alta con un identificador nuevo. El id se genera una sola vez
 * por borrador: si la peticion se reintenta, viaja el mismo (principio 6).
 */
export function prepararInscripcion(
  datos: Omit<PeticionInscripcion, "id">,
  generarId: () => string = idPorDefecto
): PeticionInscripcion {
  return { ...datos, id: generarId() };
}

export function crearApiCatequizandos(cliente: ClienteHttp) {
  return {
    inscribir: (datos: PeticionInscripcion) =>
      cliente.solicitar<RespuestaInscripcion>("POST", "/inscripciones", datos),
    confirmarDuplicado: (referencia: string, esElMismo: boolean) =>
      cliente.solicitar("POST", "/inscripciones/duplicados/confirmar", { referencia, esElMismo }),
    consultarPerfil: (id: string) =>
      cliente.solicitar("GET", `/catequizandos/${encodeURIComponent(id)}/perfil`),
    consultarDocumentos: (id: string) =>
      cliente.solicitar("GET", `/inscripciones/${encodeURIComponent(id)}/documentos`),
    consultarCarne: (id: string) =>
      cliente.solicitar<Carne>("GET", `/catequizandos/${encodeURIComponent(id)}/carne`),
    reemitirCarne: (id: string, emisionEsperada: number) =>
      cliente.solicitar<Carne>("POST", `/catequizandos/${encodeURIComponent(id)}/carne/reemitir`, {
        emisionEsperada,
      }),
    buscarApoderados: (consulta: string) =>
      cliente.solicitar("GET", `/apoderados?q=${encodeURIComponent(consulta)}`),
    listarCarnesGrupo: async (grupoId: string) => {
      const respuesta = await cliente.solicitar<{ carnes: Carne[] }>(
        "GET",
        `/grupos/${encodeURIComponent(grupoId)}/carnes`
      );
      return respuesta.carnes;
    },
    listarGrupos: async (cicloId: string) => {
      const respuesta = await cliente.solicitar<{ grupos: GrupoApi[] }>(
        "GET",
        `/ciclos/${encodeURIComponent(cicloId)}/grupos`
      );
      return respuesta.grupos;
    },
    sugerirGrupos: async (datos: { fechaNacimiento: string; sexo: string }) => {
      const respuesta = await cliente.solicitar<{ grupos: GrupoApi[] }>("POST", "/grupos/sugerencias", datos);
      return respuesta.grupos;
    },
    cicloAbierto: () => cliente.solicitar<CicloAbierto | null>("GET", "/ciclos/abierto"),
    crearGrupo: (datos: {
      id: string;
      nombre: string;
      edadMinima: number;
      edadMaxima: number;
      modalidad: string;
    }) => cliente.solicitar<{ id: string }>("POST", "/grupos", datos),
    renombrarGrupo: (id: string, datos: { nombre?: string; edadMinima?: number; edadMaxima?: number; modalidad?: string }) =>
      cliente.solicitar("PATCH", `/grupos/${encodeURIComponent(id)}`, datos),
    cerrarGrupo: (id: string) => cliente.solicitar("POST", `/grupos/${encodeURIComponent(id)}/cerrar`, {}),
    asignarCatequistas: (id: string, asignaciones: { id: string; cuentaId: string }[]) =>
      cliente.solicitar("PUT", `/grupos/${encodeURIComponent(id)}/catequistas`, { asignaciones }),
  };
}

export type ApiCatequizandos = ReturnType<typeof crearApiCatequizandos>;
