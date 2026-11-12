import { readFileSync } from "node:fs";
import { join } from "node:path";
import { confirmarLista, abrirLista, alternar } from "@/lib/asistencia/lista";
import {
  idListaAsistencia,
  listaALocal,
  marcaALocal,
  prepararLote,
} from "@/lib/asistencia/pendientes";
import { aSesion, type FilaSesion } from "@/lib/asistencia/sesiones";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { cerrarPool, consultar } from "../src/compartido/bd/pool";

/**
 * Recorre el guion de la demo contra la API local: activa el enlace del
 * catequista, baja la nomina, confirma la lista de catequesis con una
 * ausencia y la envia dos veces para comprobar que el servidor no duplica
 * nada. Es la version automatica de lo que hace el celular.
 */

const API = (process.env.URL_API ?? "http://127.0.0.1:7071/api").replace(/\/+$/, "");
const DISPOSITIVO = process.env.DISPOSITIVO_DEMO ?? "00000000-0000-4000-8000-000000000001";
const archivoDemo = join(__dirname, "..", "demo-local.json");

type DatosDemo = {
  token: string;
  grupoId: string;
  fechaSesion: string;
};

type RespuestaPull = {
  changes: Record<string, { created: Record<string, unknown>[] }>;
};

function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown, token?: string): Promise<T> {
  return fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  }).then(async respuesta => {
    const texto = await respuesta.text();
    if (!respuesta.ok) throw new Error(`${metodo} ${ruta} -> ${respuesta.status} ${texto}`);
    return (texto ? JSON.parse(texto) : {}) as T;
  });
}

async function main(): Promise<void> {
  const demo = JSON.parse(readFileSync(archivoDemo, "utf8")) as DatosDemo;
  console.info(`Guion de la demo contra ${API}`);

  const activacion = await pedir<{ jwt: string; contexto: ContextoAcceso }>(
    "POST",
    "/acceso/equipo/activar",
    { token: demo.token, dispositivoId: DISPOSITIVO }
  );
  console.info(`1. Enlace activado: ${activacion.contexto.identidadOperativa} (${activacion.contexto.rolesPropios.join(", ")})`);
  // El servidor exige que el registro no sea anterior a la activacion de la
  // credencial: se espera un instante para que la hora del dispositivo quede
  // dentro de la ventana.
  await new Promise(resolver => setTimeout(resolver, 1500));

  const pull = await pedir<RespuestaPull>("GET", "/sincronizacion/cambios", undefined, activacion.jwt);
  const grupos = pull.changes.grupos?.created ?? [];
  const ninos = (pull.changes.catequizandos?.created ?? []).filter(
    fila => fila.grupo_id === demo.grupoId && fila.activo !== false
  );
  const sesiones = (pull.changes.sesiones?.created ?? []).map(fila => aSesion(fila as unknown as FilaSesion));
  const sesion = sesiones.find(
    candidata => candidata.cicloId === String(grupos[0]?.ciclo_id) && candidata.fecha === fechaEnLima(Date.now()) && candidata.tipo === "catequesis"
  );
  console.info(`2. Nomina bajada: ${grupos.length} grupo(s), ${ninos.length} ninos, ${sesiones.length} sesion(es)`);
  if (!sesion) throw new Error("El pull no trae la sesion de catequesis de hoy");
  if (ninos.length === 0) throw new Error("El pull no trae ninos del grupo demo");

  const nomina = ninos.map(fila => ({
    id: String(fila.id),
    nombres: String(fila.nombres),
    apellidos: String(fila.apellidos),
    grupoId: String(fila.grupo_id),
    codigoCarne: fila.codigo_carne ? String(fila.codigo_carne) : null,
    activo: fila.activo !== false,
  }));
  let borrador = abrirLista(nomina);
  borrador = alternar(borrador, nomina[1].id);
  const hora = new Date().toISOString();
  const { lista, marcas } = confirmarLista({
    borrador,
    cuenta: activacion.contexto,
    sesion,
    grupoId: demo.grupoId,
    id: idListaAsistencia(sesion.id, demo.grupoId),
    abiertaEn: hora,
    hora,
    desfaseRelojMs: 0,
  });
  const lote = prepararLote({
    marcas: marcas.map(marca => ({ id: marca.id, fila: marcaALocal(marca) })),
    listas: [{ id: lista.id, fila: listaALocal(lista) }],
    correcciones: [],
  });
  console.info(`3. Lista preparada: ${lista.totalPresentes} presentes, ${lista.totalAusentes} ausente(s), ${marcas.length} marcas`);

  const primero = await pedir<{ aceptados: number; rechazados: number; descartadosCierre: number }>(
    "POST",
    "/sincronizacion/cambios",
    { changes: lote },
    activacion.jwt
  );
  console.info(`4. Primer envio: aceptados=${primero.aceptados} rechazados=${primero.rechazados}`);
  if (primero.rechazados > 0) throw new Error("El servidor rechazo registros de la lista");

  const segundo = await pedir<{ aceptados: number; rechazados: number }>(
    "POST",
    "/sincronizacion/cambios",
    { changes: lote },
    activacion.jwt
  );
  console.info(`5. Reenvio del mismo lote: aceptados=${segundo.aceptados} rechazados=${segundo.rechazados}`);

  const marcasEnServidor = await consultar<{ cantidad: number }>(
    "SELECT count(*)::int cantidad FROM marca_asistencia WHERE sesion_id=$1",
    [sesion.id]
  );
  const listasEnServidor = await consultar<{ cantidad: number }>(
    "SELECT count(*)::int cantidad FROM lista_asistencia WHERE sesion_id=$1",
    [sesion.id]
  );
  const marcasDistintas = await consultar<{ cantidad: number }>(
    "SELECT count(DISTINCT catequizando_id)::int cantidad FROM marca_asistencia WHERE sesion_id=$1",
    [sesion.id]
  );
  console.info(
    `6. En el servidor: ${marcasEnServidor.rows[0].cantidad} marcas, ${listasEnServidor.rows[0].cantidad} lista(s), ${marcasDistintas.rows[0].cantidad} ninos distintos`
  );
  if (marcasEnServidor.rows[0].cantidad !== marcas.length) throw new Error("El servidor guardo marcas de mas: hay duplicados");
  if (listasEnServidor.rows[0].cantidad !== 1) throw new Error("El servidor guardo mas de una lista");

  console.info("Guion completo sin duplicados en el servidor");
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(cerrarPool);
