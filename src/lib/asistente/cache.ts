import type { RespuestaAsistente } from "./tipos";

export type OpcionesCache = {
  maximo?: number;
  ttlMs?: number;
  ahora?: () => number;
};

const MAXIMO_PREDETERMINADO = 100;
const TTL_PREDETERMINADO_MS = 5 * 60 * 1000;

type EntradaCache = {
  valor: RespuestaAsistente;
  expira: number;
};

function claveDe(versionCorpus: string, preguntaNormalizada: string, contexto: string): string {
  return `${versionCorpus}\u0000${preguntaNormalizada}\u0000${contexto}`;
}

/**
 * Caché en memoria por proceso. La clave incluye la versión del corpus para no servir respuestas viejas
 * después de actualizar los fragmentos. No guarda la pregunta original ni datos de la cuenta.
 */
export class CacheRespuestas {
  private readonly maximo: number;
  private readonly ttlMs: number;
  private readonly ahora: () => number;
  private readonly entradas = new Map<string, EntradaCache>();

  constructor(opciones: OpcionesCache = {}) {
    this.maximo = opciones.maximo ?? MAXIMO_PREDETERMINADO;
    this.ttlMs = opciones.ttlMs ?? TTL_PREDETERMINADO_MS;
    this.ahora = opciones.ahora ?? Date.now;
  }

  get tamano(): number {
    return this.entradas.size;
  }

  obtener(versionCorpus: string, preguntaNormalizada: string, contexto = ""): RespuestaAsistente | undefined {
    const clave = claveDe(versionCorpus, preguntaNormalizada, contexto);
    const entrada = this.entradas.get(clave);
    if (!entrada) return undefined;
    if (entrada.expira <= this.ahora()) {
      this.entradas.delete(clave);
      return undefined;
    }
    this.entradas.delete(clave);
    this.entradas.set(clave, entrada);
    return entrada.valor;
  }

  guardar(
    versionCorpus: string,
    preguntaNormalizada: string,
    valor: RespuestaAsistente,
    contexto = "",
  ): void {
    if (this.maximo <= 0) return;
    const clave = claveDe(versionCorpus, preguntaNormalizada, contexto);
    this.entradas.delete(clave);
    while (this.entradas.size >= this.maximo) {
      const masAntigua = this.entradas.keys().next().value;
      if (masAntigua === undefined) break;
      this.entradas.delete(masAntigua);
    }
    this.entradas.set(clave, { valor, expira: this.ahora() + this.ttlMs });
  }

  limpiar(): void {
    this.entradas.clear();
  }
}
