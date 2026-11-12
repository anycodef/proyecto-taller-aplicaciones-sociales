import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { puedeRegistrarManual } from "./autorizacion";
import { idMarcaAsistencia } from "./pendientes";
import { dentroDeVentana, horaEfectiva } from "./reloj";
import { ventanaDe } from "./sesiones";
import type { MarcaAsistencia, NinoNomina, Sesion } from "./tipos";

export type ResultadoRegistroManual = {
  resultado: "registrado" | "ya_registrado" | "fuera_de_alcance" | "fuera_de_ventana";
  marca?: MarcaAsistencia;
};

/**
 * Registro manual de respaldo: el nino no trae carné o no se puede leer. Solo
 * se registra a ninos de los grupos del catequista y el registro queda
 * marcado como manual para que el reporte lo cuente (RF-304).
 */
export function procesarRegistroManual(entrada: {
  cuenta: ContextoAcceso;
  sesion: Sesion;
  nino: NinoNomina;
  existentes: MarcaAsistencia[];
  horaDispositivo: string;
  desfaseRelojMs: number;
}): ResultadoRegistroManual {
  const { cuenta, sesion, nino } = entrada;
  if (!cuenta.dispositivoId) return { resultado: "fuera_de_alcance" };
  if (!puedeRegistrarManual(cuenta, nino)) return { resultado: "fuera_de_alcance" };
  if (sesion.cancelada || sesion.tipo !== "misa") return { resultado: "fuera_de_alcance" };
  if (
    !dentroDeVentana(
      horaEfectiva(entrada.horaDispositivo, entrada.desfaseRelojMs),
      ventanaDe(sesion)
    )
  ) {
    return { resultado: "fuera_de_ventana" };
  }
  const yaRegistrado = entrada.existentes.some(
    (marca) =>
      marca.sesionId === sesion.id &&
      marca.catequizandoId === nino.id &&
      marca.estado !== "rechazada"
  );
  if (yaRegistrado) return { resultado: "ya_registrado" };

  return {
    resultado: "registrado",
    marca: {
      id: idMarcaAsistencia(sesion.id, nino.id, "manual"),
      cicloId: sesion.cicloId,
      sesionId: sesion.id,
      catequizandoId: nino.id,
      codigoLeido: null,
      valor: "presente",
      tipoRegistro: "manual",
      listaId: null,
      registradoPor: cuenta.cuentaId,
      credencialId: cuenta.credencialId,
      dispositivoId: cuenta.dispositivoId,
      horaDispositivo: entrada.horaDispositivo,
      desfaseRelojMs: entrada.desfaseRelojMs,
      estado: "pendiente",
    },
  };
}

/** Compara sin tildes ni mayusculas, para que el nombre se encuentre como se escribe. */
export function textoComparable(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Nino por nombre o apellido: solo los de los grupos del catequista. */
export function buscarNinosPorNombre(ninos: NinoNomina[], busqueda: string): NinoNomina[] {
  const texto = textoComparable(busqueda);
  if (!texto) return ninos;
  return ninos.filter((nino) => {
    const nombre = textoComparable(`${nino.nombres} ${nino.apellidos}`);
    return nombre.includes(texto);
  });
}
