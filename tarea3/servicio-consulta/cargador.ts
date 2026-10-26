// Cargador por lote casero para evitar el N+1 (spec 009, T009-23).
//
// No se usa la libreria dataloader porque plan §3 no la autoriza. La idea es la
// misma: los resolvers hermanos piden su clave por separado y el cargador junta
// todas las claves del mismo turno en una sola consulta.
//
// El vaciado se programa con una microtarea seguida de process.nextTick: la
// microtarea deja que terminen los `await` de los resolvers hermanos (que
// tambien son microtareas) y solo entonces, ya en el siguiente tick, se
// consulta con la lista completa de claves. Vaciar en la microtarea misma
// partiria el lote en varias consultas.

export type FuncionLote<K, V> = (claves: readonly K[]) => Promise<Map<K, V>>;

export interface Cargador<K, V> {
  cargar: (clave: K) => Promise<V | undefined>;
  // Cuantas veces se ha vaciado el cargador; solo para las pruebas de N+1.
  lotes: () => number;
}

interface Espera<V> {
  resolver: (valor: V | undefined) => void;
  rechazar: (error: unknown) => void;
}

export function crearCargador<K, V>(cargarLote: FuncionLote<K, V>): Cargador<K, V> {
  const cola = new Map<K, Espera<V>[]>();
  let programado = false;
  let lotes = 0;

  async function vaciar(): Promise<void> {
    programado = false;
    if (cola.size === 0) return;

    const claves = [...cola.keys()];
    const esperas = [...cola.values()];
    cola.clear();
    lotes += 1;

    try {
      const resultado = await cargarLote(claves);
      claves.forEach((clave, indice) => {
        const valor = resultado.get(clave);
        for (const espera of esperas[indice]) espera.resolver(valor);
      });
    } catch (error) {
      for (const grupo of esperas) {
        for (const espera of grupo) espera.rechazar(error);
      }
    }
  }

  function programar(): void {
    if (programado) return;
    programado = true;
    Promise.resolve().then(() => process.nextTick(vaciar));
  }

  return {
    cargar(clave) {
      return new Promise<V | undefined>((resolver, rechazar) => {
        const esperas = cola.get(clave);
        if (esperas) {
          esperas.push({ resolver, rechazar });
        } else {
          cola.set(clave, [{ resolver, rechazar }]);
        }
        programar();
      });
    },
    lotes: () => lotes,
  };
}
