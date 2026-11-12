import { v5 as uuidV5 } from "uuid";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import { idSesion } from "@/lib/asistencia/sesiones";
import { enTransaccion } from "../src/compartido/bd/transaccion";
import { cerrarPool } from "../src/compartido/bd/pool";
import { crearAdministracionInicial } from "./crear-administracion-inicial";
import { crearCuenta, emitirEnlace } from "../src/modulos/seguridad/aplicacion/cuentas";
import { abrirCiclo } from "../src/modulos/ciclos/aplicacion/gestionar-ciclo";
import { crearInscripcion } from "../src/modulos/inscripciones/aplicacion/inscribir";
import { TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";

const id = (nombre: string) => uuidV5(nombre, "c14a3f20-1b98-4da8-a075-4f680d5a1000");
const NINOS_DEMO = 8;
const DISPOSITIVO_DEMO = "00000000-0000-4000-8000-000000000001";

export type ResultadoDemo = {
  enlacesNuevos: { identidadOperativa: string; url: string }[];
  demo: {
    cuentaCatequista: string;
    identidadOperativa: string;
    grupo: string;
    ninos: number;
    fechaSesion: string;
    enlace: string;
    enlaceExpo: string | null;
  };
};

/** Enlace de Expo Go para abrir la activacion en el celular de la demo. */
function enlaceExpo(url: string): string | null {
  const base = process.env.URL_APP_EXPO;
  if (!base) return null;
  const token = url.split("#t=")[1];
  if (!token) return null;
  // Expo Go descarta el fragmento (#t=) de un exp://, así que el token viaja en la consulta.
  return `${base.replace(/\/+$/, "")}/acceso/equipo?t=${token}`;
}

export async function sembrarDemo(): Promise<ResultadoDemo> {
  const inicial = await enTransaccion(tx => crearAdministracionInicial(tx, "Administración demo"));
  const enlaces = inicial ? [{ identidadOperativa: "Administración demo", url: inicial.url }] : [];
  const ctx = await enTransaccion(async tx => {
    const fila = (await tx.query<{ id: string; credencial_id: string }>("SELECT c.id,cr.id credencial_id FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id AND r.rol='administracion' JOIN credencial cr ON cr.cuenta_id=c.id AND cr.tipo='equipo' AND cr.estado<>'terminada' WHERE c.activa ORDER BY c.creada_en LIMIT 1")).rows[0];
    if (!fila) throw new Error("Falta administración con credencial");
    return { cuentaId: fila.id, credencialId: fila.credencial_id, identidadOperativa: "Administración demo", rolesPropios: ["administracion", "coordinacion"] as Rol[], gruposAsignados: [], catequizandosApoderados: [], esMenor: false } satisfies ContextoAcceso;
  });
  const cuentas: { clave: string; nombre: string; roles: Rol[]; menor: boolean }[] = [
    { clave: "coord", nombre: "Coordinación demo", roles: ["coordinacion"], menor: false },
    { clave: "cat", nombre: "Catequista demo", roles: ["catequista"], menor: false },
    { clave: "menor", nombre: "Luz demo", roles: ["catequista"], menor: true },
    { clave: "sup", nombre: "Supervisión demo", roles: ["supervision"], menor: false },
    { clave: "mixta", nombre: "Cuenta mixta demo", roles: ["catequista", "familia"], menor: false },
  ];
  let enlaceCatequista = "";
  for (const cuenta of cuentas) {
    const creada = await crearCuenta({ id: id(cuenta.clave), identidadOperativa: cuenta.nombre, esMenor: cuenta.menor, roles: cuenta.roles }, ctx);
    if (!creada) continue;
    const emitido = await emitirEnlace(id(cuenta.clave), "equipo", undefined, ctx);
    enlaces.push({ identidadOperativa: cuenta.nombre, ...emitido });
    if (cuenta.clave === "cat") enlaceCatequista = emitido.url;
  }
  // El catequista de demo siempre recibe un enlace nuevo: repetir la siembra
  // deja el celular listo para activarse otra vez.
  if (!enlaceCatequista) {
    const emitido = await emitirEnlace(id("cat"), "equipo", undefined, ctx);
    enlaceCatequista = emitido.url;
  }
  let grupoDemo = "";
  let fechaSesion = "";
  await enTransaccion(async tx => {
    await tx.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'coordinacion') ON CONFLICT DO NOTHING", [ctx.cuentaId]);
    const anio = new Date().getUTCFullYear();
    const ciclo = (await tx.query<{ id: string; inicio: string }>("SELECT id,inicio::text FROM ciclo WHERE estado='abierto'")).rows[0];
    if (!ciclo) await abrirCiclo({ id: id("ciclo"), nombre: `${anio} demo`, fechaInicio: `${anio}-01-01`, fechaFin: `${anio}-12-31` }, ctx, tx);
    const actual = (await tx.query<{ id: string; inicio: string }>("SELECT id,inicio::text FROM ciclo WHERE estado='abierto'")).rows[0];
    await tx.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Grupo demo',8,10,'mixto') ON CONFLICT(id) DO NOTHING", [id("grupo"), actual.id]);
    for (const clave of ["cat", "menor", "mixta"]) await tx.query("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING", [id(`asignacion:${clave}`), id("grupo"), id(clave)]);
    const textoId = (await tx.query<{ id: string }>("SELECT id FROM texto_consentimiento WHERE vigente_desde<=now() ORDER BY vigente_desde DESC LIMIT 1")).rows[0].id;
    for (let numero = 1; numero <= NINOS_DEMO; numero++) {
      const apoderadoId = id("apoderado");
      const resultado = await crearInscripcion(tx, {
        id: id(`inscripcion:${numero}`), nino: { id: id(`nino:${numero}`), nombres: `Niño ficticio ${numero}`, apellidos: "Demostración", fechaNacimiento: `${Number(actual.inicio.slice(0, 4)) - 9}-01-01`, sexo: "masculino", bautizado: false },
        grupoId: id("grupo"), asignacionId: id(`grupo:nino:${numero}`), edadFueraRangoConfirmada: false,
        apoderados: [{ id: id(`vinculo:${numero}`), relacion: "madre", ...(numero === 1 ? { apoderado: { id: apoderadoId, nombres: "Familia ficticia", apellidos: "Demostración", tipoContacto: "otro" as const, valorContacto: "Contacto ficticio", cuentaId: id("familia"), credencialId: id("credencial:familia") } } : { apoderadoId }) }],
        consentimiento: { id: id(`consentimiento:${numero}`), apoderadoId, textoId, canal: "presencial" }, documentos: TIPOS_DOCUMENTO.map(tipo => ({ id: id(`documento:${numero}:${tipo}`), tipo })),
      }, ctx);
      if (resultado.estado === 409) throw new Error("Conflicto inesperado en datos demo");
      for (const enlace of resultado.datos.enlaces) enlaces.push({ identidadOperativa: "Familia demo", url: enlace.url });
    }
    const mixto = await tx.query("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto,cuenta_id) VALUES($1,'Apoderado mixto','Demostración','otro','Contacto ficticio',$2) ON CONFLICT(id) DO NOTHING RETURNING id", [id("apoderado:mixta"), id("mixta")]);
    await tx.query("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'tutor') ON CONFLICT(id) DO NOTHING", [id("vinculo:mixta"), id("nino:1"), id("apoderado:mixta")]);
    if (mixto.rowCount) enlaces.push({ identidadOperativa: "Cuenta mixta demo (familia)", ...(await emitirEnlace(id("mixta"), "familia", tx, ctx)) });

    // Sesion de catequesis de hoy: es la que la lista necesita para pasar
    // lista el mismo dia. El id es determinista, asi que repetir no duplica.
    // La ventana es de todo el dia para que la demo sirva a cualquier hora.
    fechaSesion = fechaEnLima(Date.now());
    const idSesionDemo = idSesion(actual.id, fechaSesion, "catequesis");
    await tx.query(
      "INSERT INTO sesion(id,ciclo_id,fecha,tipo,ventana_inicio,ventana_fin,cancelada,actualizado_por,cuenta_id,credencial_id,dispositivo_id) VALUES($1,$2,$3,'catequesis','00:00:00','23:59:59',false,$4,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET ventana_inicio=EXCLUDED.ventana_inicio,ventana_fin=EXCLUDED.ventana_fin",
      [idSesionDemo, actual.id, fechaSesion, ctx.cuentaId, ctx.credencialId, DISPOSITIVO_DEMO]
    );
    grupoDemo = "Grupo demo";

    // La sesion de demo arranca limpia: las marcas son inmutables y un
    // intento rechazado con otro momento dejaria el id bloqueado para siempre.
    await tx.query("SET LOCAL ROLE sigecat_retencion");
    await tx.query("SELECT set_config('sigecat.contexto','retencion',true)");
    await tx.query("DELETE FROM aviso_asistencia WHERE sesion_id=$1", [idSesionDemo]);
    await tx.query("DELETE FROM asistencia WHERE sesion_id=$1", [idSesionDemo]);
    await tx.query("DELETE FROM marca_asistencia WHERE sesion_id=$1", [idSesionDemo]);
    await tx.query("DELETE FROM lista_asistencia WHERE sesion_id=$1", [idSesionDemo]);
    await tx.query("RESET ROLE");
  });
  return {
    enlacesNuevos: enlaces,
    demo: {
      cuentaCatequista: id("cat"),
      identidadOperativa: "Catequista demo",
      grupo: grupoDemo,
      ninos: NINOS_DEMO,
      fechaSesion,
      enlace: enlaceCatequista,
      enlaceExpo: enlaceExpo(enlaceCatequista),
    },
  };
}
/** El enlace lleva el token y solo se muestra una vez: se guarda en un archivo local para `verificar:demo` y el guion. */
export function guardarDemoLocal(resultado: ResultadoDemo): void {
  const token = resultado.demo.enlace.split("#t=")[1] ?? "";
  writeFileSync(
    join(__dirname, "..", "demo-local.json"),
    JSON.stringify({ ...resultado.demo, token, grupoId: id("grupo"), cuentaCatequista: resultado.demo.cuentaCatequista }, null, 2)
  );
}
if (require.main === module) {
  sembrarDemo()
    .then(resultado => {
      guardarDemoLocal(resultado);
      console.info(JSON.stringify({ enlacesNuevos: resultado.enlacesNuevos, demo: resultado.demo }, null, 2));
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      console.error("No se pudo sembrar demo; usar una BD de desarrollo migrada");
      process.exitCode = 1;
    })
    .finally(cerrarPool);
}
