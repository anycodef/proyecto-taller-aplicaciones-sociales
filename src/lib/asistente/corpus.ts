import type { Corpus, Fragmento } from "./tipos";

const CAMPOS = ["id", "documento", "seccion", "texto", "fuente", "licencia", "version"] as const;

export class ErrorCorpus extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorCorpus";
  }
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function leerTexto(registro: Record<string, unknown>, campo: string, contexto: string): string {
  const valor = registro[campo];
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErrorCorpus(`${contexto} no tiene ${campo}.`);
  }
  return valor.trim();
}

export function cargarCorpus(entrada: unknown): Corpus {
  if (!esRegistro(entrada)) {
    throw new ErrorCorpus("El corpus debe ser un objeto con version y fragmentos.");
  }

  const version = leerTexto(entrada, "version", "El corpus");
  if (!Array.isArray(entrada.fragmentos)) {
    throw new ErrorCorpus("El corpus debe incluir un arreglo de fragmentos.");
  }

  const ids = new Set<string>();
  const fragmentos: Fragmento[] = entrada.fragmentos.map((valor, indice) => {
    const contexto = `El fragmento ${indice + 1}`;
    if (!esRegistro(valor)) throw new ErrorCorpus(`${contexto} debe ser un objeto.`);

    const fragmento = Object.fromEntries(
      CAMPOS.map((campo) => [campo, leerTexto(valor, campo, contexto)]),
    ) as Fragmento;

    if (ids.has(fragmento.id)) {
      throw new ErrorCorpus(`El corpus repite el id ${fragmento.id}.`);
    }
    ids.add(fragmento.id);
    return fragmento;
  });

  return { version, fragmentos };
}
