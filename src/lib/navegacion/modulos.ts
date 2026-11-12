import type { Rol } from "@/lib/seguridad/contexto-acceso";
import { permisoPara } from "@/lib/seguridad/matriz-permisos";

/** Panel de entrada donde se ofrece el modulo. */
export type Panel = "coordinacion" | "familia";

/**
 * `pendiente` hasta que la pantalla este unida a main. Conectar una pantalla es
 * cambiar su estado a `disponible` (RF-1206); la prueba del registro exige que la
 * ruta exista y que el permiso este en MATRIZ_PERMISOS.
 */
export type EstadoModulo = "disponible" | "pendiente";

export type Modulo = {
  id: string;
  spec: "003" | "004" | "007";
  panel: Panel;
  titulo: string;
  subtitulo: string;
  ruta: string;
  /** Permiso que exige la API. Puede no existir aun si su spec todavia no lo agrego. */
  accion: string;
  estado: EstadoModulo;
};

export const MODULOS: readonly Modulo[] = [
  {
    id: "avisos-asistencia",
    spec: "003",
    panel: "coordinacion",
    titulo: "Avisos de asistencia",
    subtitulo: "Carnés inválidos, rechazos y conflictos por atender",
    ruta: "/coordinacion/avisos-asistencia",
    accion: "asistencia:avisos",
    estado: "pendiente",
  },
  {
    id: "justificaciones",
    spec: "004",
    panel: "coordinacion",
    titulo: "Justificaciones",
    subtitulo: "Bandeja de justificaciones por revisar",
    ruta: "/coordinacion/justificaciones",
    accion: "justificacion:revisar",
    estado: "pendiente",
  },
  {
    id: "riesgo",
    spec: "007",
    panel: "coordinacion",
    titulo: "Riesgo de deserción",
    subtitulo: "Niños por paso de seguimiento y faltas de origen",
    ruta: "/riesgo",
    accion: "riesgo:leer",
    estado: "pendiente",
  },
  {
    id: "justificar",
    spec: "004",
    panel: "familia",
    titulo: "Justificar una ausencia",
    subtitulo: "Envío con foto del comprobante",
    ruta: "/familia/justificar",
    accion: "justificacion:enviar",
    estado: "pendiente",
  },
];

export type ModulosDelPanel = { conectados: Modulo[]; proximamente: Modulo[] };

/**
 * Un modulo se enlaza si esta disponible y algun rol tiene su permiso. Si aun no
 * esta disponible, o su permiso todavia no existe, se anuncia como proximo; si el
 * permiso existe y ningun rol lo tiene, no se muestra.
 */
export function modulosDelPanel(panel: Panel, roles: readonly Rol[], modulos: readonly Modulo[] = MODULOS): ModulosDelPanel {
  const resultado: ModulosDelPanel = { conectados: [], proximamente: [] };
  for (const modulo of modulos) {
    if (modulo.panel !== panel) continue;
    const permiso = permisoPara(modulo.accion);
    const autorizado = permiso !== undefined && roles.some((rol) => permiso.roles[rol] !== undefined);
    if (modulo.estado === "disponible" && autorizado) resultado.conectados.push(modulo);
    else if (permiso === undefined || autorizado) resultado.proximamente.push(modulo);
  }
  return resultado;
}
