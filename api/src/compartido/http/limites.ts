import { consultar } from "../bd/pool";
import { ErrorAplicacion } from "./respuestas";

export async function limitarPorCuenta(cuentaId: string, operacion: string, maximo: number, segundos: number): Promise<void> {
  const resultado = await consultar<{ cantidad: number }>(`INSERT INTO contador_limite(cuenta_id,operacion,ventana,cantidad)
    VALUES($1,$2,floor(extract(epoch FROM clock_timestamp())/$3)::bigint,1)
    ON CONFLICT(cuenta_id,operacion,ventana) DO UPDATE SET cantidad=contador_limite.cantidad+1 RETURNING cantidad`, [cuentaId, operacion, segundos]);
  if (resultado.rows[0].cantidad > maximo) throw new ErrorAplicacion(429, "limite_excedido");
}
