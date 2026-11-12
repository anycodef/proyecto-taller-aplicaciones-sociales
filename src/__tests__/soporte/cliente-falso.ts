import type { ClienteHttp } from "@/lib/seguridad/api";

export type LlamadaFalsa = { metodo: string; ruta: string; cuerpo?: unknown };

export type BinarioFalso = { metodo: string; ruta: string; contentType: string; datos: unknown };
export type ClienteFalso = ClienteHttp & { llamadas: LlamadaFalsa[]; binarios: BinarioFalso[] };

/** Cliente que responde con lo que se le indica, para probar sin servidor. */
export function crearClienteFalso(respuestas: Record<string, unknown>): ClienteFalso {
  const llamadas: LlamadaFalsa[] = [];
  const binarios: BinarioFalso[] = [];

  return {
    llamadas,
    binarios,
    solicitarBinario: async <T>(metodo: string, ruta: string, datos: unknown, contentType: string): Promise<T> => {
      binarios.push({ metodo, ruta, contentType, datos });
      const clave = `${metodo} ${ruta}`;
      const respuesta = respuestas[clave];
      if (respuesta instanceof Error) throw respuesta;
      return (respuesta ?? { orden: 1, bytes: 1 }) as T;
    },
    solicitar: async <T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> => {
      llamadas.push({ metodo, ruta, cuerpo });
      const clave = `${metodo} ${ruta.split("?")[0]}`;
      if (!(clave in respuestas)) throw new Error(`sin respuesta para ${clave}`);
      const respuesta = respuestas[clave];
      if (respuesta instanceof Error) throw respuesta;
      return respuesta as T;
    },
  };
}
