import type { ClienteHttp } from "@/lib/seguridad/api";

export type LlamadaFalsa = { metodo: string; ruta: string; cuerpo?: unknown };

export type ClienteFalso = ClienteHttp & { llamadas: LlamadaFalsa[] };

/** Cliente que responde con lo que se le indica, para probar sin servidor. */
export function crearClienteFalso(respuestas: Record<string, unknown>): ClienteFalso {
  const llamadas: LlamadaFalsa[] = [];

  return {
    llamadas,
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
