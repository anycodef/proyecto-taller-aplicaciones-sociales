import type { AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { idListaAsistencia } from "./pendientes";
import type { ValorAsistencia } from "./tipos";

export type ListaConfirmadaLocal = {
  id: string;
  totalPresentes: number;
  totalAusentes: number;
  /** Aun no llega al servidor: se enviara al volver la señal. */
  porEnviar: boolean;
  /** El servidor la guardo como rechazada (RF-303). */
  rechazada: boolean;
  motivoRechazo: string | null;
  /** Valor de cada nino en la lista confirmada. */
  valores: Record<string, ValorAsistencia>;
};

/**
 * Lista ya confirmada de un grupo en una sesion, tal como la conoce el
 * celular: pendiente de enviar o devuelta por el servidor. Una lista
 * confirmada no se vuelve a confirmar: su id es determinista y una segunda
 * version con otras horas seria una colision en el servidor; los cambios se
 * hacen por correccion (RF-306, RF-309).
 */
export function listaConfirmadaLocal(
  almacen: AlmacenLocal,
  sesionId: string,
  grupoId: string
): ListaConfirmadaLocal | null {
  const id = idListaAsistencia(sesionId, grupoId);

  const pendiente = almacen.pendientes.listas.find((lista) => lista.id === id);
  if (pendiente) {
    const valores: Record<string, ValorAsistencia> = {};
    for (const marca of almacen.pendientes.marcas) {
      if (marca.fila.lista_id === id && marca.fila.catequizando_id) {
        valores[marca.fila.catequizando_id] = marca.fila.valor;
      }
    }
    return {
      id,
      totalPresentes: pendiente.fila.total_presentes,
      totalAusentes: pendiente.fila.total_ausentes,
      porEnviar: true,
      rechazada: false,
      motivoRechazo: null,
      valores,
    };
  }

  const enviada = almacen.colecciones.listas_asistencia?.[id];
  if (!enviada) return null;
  const valores: Record<string, ValorAsistencia> = {};
  for (const marca of Object.values(almacen.colecciones.marcas_asistencia ?? {})) {
    if (marca.lista_id !== id || typeof marca.catequizando_id !== "string") continue;
    if (marca.valor === "presente" || marca.valor === "ausente") valores[marca.catequizando_id] = marca.valor;
  }
  return {
    id,
    totalPresentes: Number(enviada.total_presentes ?? 0),
    totalAusentes: Number(enviada.total_ausentes ?? 0),
    porEnviar: false,
    rechazada: enviada.estado === "rechazada",
    motivoRechazo: typeof enviada.motivo_rechazo === "string" ? enviada.motivo_rechazo : null,
    valores,
  };
}

/** Registros que el servidor guardo como rechazados para la cuenta, con su motivo (RF-303). */
export type RegistroRechazado = {
  id: string;
  tipo: "marca" | "lista" | "correccion";
  catequizandoId: string | null;
  sesionId: string;
  motivo: string;
};

export function rechazadosDeLaCuenta(almacen: AlmacenLocal, cuentaId: string): RegistroRechazado[] {
  const tablas: [string, RegistroRechazado["tipo"]][] = [
    ["listas_asistencia", "lista"],
    ["marcas_asistencia", "marca"],
    ["correcciones_asistencia", "correccion"],
  ];
  const rechazados: RegistroRechazado[] = [];
  for (const [tabla, tipo] of tablas) {
    for (const fila of Object.values(almacen.colecciones[tabla] ?? {})) {
      if (fila.estado !== "rechazada" || fila.cuenta_id !== cuentaId) continue;
      rechazados.push({
        id: fila.id,
        tipo,
        catequizandoId: typeof fila.catequizando_id === "string" ? fila.catequizando_id : null,
        sesionId: String(fila.sesion_id ?? ""),
        motivo: typeof fila.motivo_rechazo === "string" ? fila.motivo_rechazo : "sin_motivo",
      });
    }
  }
  return rechazados;
}

const MOTIVOS: Record<string, string> = {
  autoria_invalida: "Lo registró otra cuenta o este celular ya no es el tuyo.",
  rol_no_autorizado: "Tu rol no permite este registro.",
  manual_fuera_de_alcance: "El niño no es de tus grupos.",
  correccion_no_autorizada: "No puedes corregir este registro.",
  sesion_invalida: "La sesión no existe en el ciclo.",
  sesion_cancelada: "La sesión fue cancelada.",
  actividad_cancelada: "La actividad fue cancelada.",
  fuera_de_alcance: "El niño no es de tus grupos.",
  hora_fuera_de_ventana: "Se registró fuera del horario de la misa.",
  lista_fuera_de_ventana: "La lista se confirmó fuera del horario de la catequesis.",
  hora_antes_credencial: "La hora del celular es anterior a tu acceso. Revisa la hora.",
  carne_invalido: "El carné no es válido.",
  codigo_no_permitido: "El carné no es válido.",
  nino_inactivo: "El niño ya no está activo.",
  nino_inactivo_en_fecha: "El niño no estaba inscrito ese día.",
  miembro_fuera_de_lista: "El niño no es del grupo de la lista.",
  miembro_lista_ya_registrado: "El niño ya estaba en la lista.",
  lista_incompleta: "La lista llegó incompleta.",
  lista_no_confirmada: "La lista no está confirmada.",
  lista_ya_completa: "La lista ya estaba completa.",
  valor_anterior_invalido: "El valor anterior no coincide con el registrado.",
  colision_id: "Se envió otra versión de un registro ya guardado.",
};

/** Motivo de rechazo en palabras de la catequista. */
export function textoMotivo(motivo: string): string {
  return MOTIVOS[motivo] ?? "El servidor no aceptó este registro.";
}

/**
 * Borrador guardado de una lista, leido del almacen. Leerlo del estado (y no
 * del repositorio) hace que cada toque guardado redibuje la pantalla.
 */
export function borradorGuardado(almacen: AlmacenLocal, borradorId: string): Record<string, ValorAsistencia> | null {
  const fila = almacen.colecciones.borradores_lista?.[borradorId];
  if (!fila || typeof fila.valores !== "string") return null;
  try {
    return JSON.parse(fila.valores) as Record<string, ValorAsistencia>;
  } catch {
    return null;
  }
}
