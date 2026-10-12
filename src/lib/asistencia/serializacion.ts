import type { FilaSincronizada } from "@/lib/sincronizacion/protocolo";
import type { Correccion, ListaAsistencia, MarcaAsistencia } from "./tipos";
export function marcaAFila(marca: MarcaAsistencia): FilaSincronizada {
  return { id: marca.id, ciclo_id: marca.cicloId, sesion_id: marca.sesionId,
    catequizando_id: marca.catequizandoId, codigo_leido: marca.codigoLeido ?? null,
    valor: marca.valor, tipo_registro: marca.tipoRegistro, lista_id: marca.listaId ?? null,
    registrado_por: marca.registradoPor, cuenta_id: marca.registradoPor,
    credencial_id: marca.credencialId, dispositivo_id: marca.dispositivoId,
    hora_dispositivo: Date.parse(marca.horaDispositivo), desfase_reloj_ms: marca.desfaseRelojMs };
}
export function listaAFila(lista: ListaAsistencia): FilaSincronizada {
  return { id: lista.id, ciclo_id: lista.cicloId, sesion_id: lista.sesionId, grupo_id: lista.grupoId,
    confirmada_por: lista.confirmadaPor, cuenta_id: lista.confirmadaPor,
    credencial_id: lista.credencialId, dispositivo_id: lista.dispositivoId,
    abierta_en: Date.parse(lista.abiertaEn), confirmada_en: Date.parse(lista.confirmadaEn),
    desfase_reloj_ms: lista.desfaseRelojMs, total_presentes: lista.totalPresentes, total_ausentes: lista.totalAusentes };
}
export function correccionAFila(correccion: Correccion, dispositivoId: string): FilaSincronizada {
  return { id: correccion.id, ciclo_id: correccion.cicloId, sesion_id: correccion.sesionId,
    catequizando_id: correccion.catequizandoId, valor_anterior: correccion.valorAnterior,
    valor_nuevo: correccion.valorNuevo, motivo: correccion.motivo ?? null,
    corregido_por: correccion.corregidoPor, cuenta_id: correccion.corregidoPor,
    credencial_id: correccion.credencialId, dispositivo_id: dispositivoId,
    hora_dispositivo: Date.parse(correccion.horaDispositivo), desfase_reloj_ms: correccion.desfaseRelojMs };
}
