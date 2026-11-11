import { v5 } from "uuid";

import { NAMESPACE_ASISTENCIA } from "./sesiones";
import type { TipoRegistro, ValorAsistencia, ListaAsistencia, MarcaAsistencia } from "./tipos";

/**
 * Id determinista de la marca: la misma sesion, el mismo nino y el mismo tipo
 * de registro producen siempre el mismo id. Asi una lista confirmada dos
 * veces, o un push reenviado, no generan marcas duplicadas (RF-307).
 */
export function idMarcaAsistencia(
  sesionId: string,
  catequizandoId: string,
  tipoRegistro: TipoRegistro
): string {
  return v5(
    JSON.stringify(["marca", sesionId, catequizandoId, tipoRegistro]),
    NAMESPACE_ASISTENCIA
  );
}

/** Id determinista de la lista de un grupo en una sesion. */
export function idListaAsistencia(sesionId: string, grupoId: string): string {
  return v5(JSON.stringify(["lista", sesionId, grupoId]), NAMESPACE_ASISTENCIA);
}

export type FilaMarca = {
  id: string;
  ciclo_id: string;
  sesion_id: string;
  catequizando_id: string | null;
  valor: ValorAsistencia;
  tipo_registro: TipoRegistro;
  lista_id: string | null;
  registrado_por: string;
  cuenta_id: string;
  credencial_id: string;
  dispositivo_id: string;
  hora_dispositivo: string;
  desfase_reloj_ms: number;
};

export type FilaLista = {
  id: string;
  ciclo_id: string;
  sesion_id: string;
  grupo_id: string | null;
  confirmada_por: string;
  cuenta_id: string;
  credencial_id: string;
  dispositivo_id: string;
  abierta_en: string;
  confirmada_en: string;
  desfase_reloj_ms: number;
  total_presentes: number;
  total_ausentes: number;
};

export type MarcaPendiente = {
  id: string;
  fila: FilaMarca;
};

/** Traduce una marca del dominio a la fila que queda pendiente de enviar. */
export function marcaALocal(marca: MarcaAsistencia): FilaMarca {
  return {
    id: marca.id,
    ciclo_id: marca.cicloId,
    sesion_id: marca.sesionId,
    catequizando_id: marca.catequizandoId,
    valor: marca.valor,
    tipo_registro: marca.tipoRegistro,
    lista_id: marca.listaId ?? null,
    registrado_por: marca.registradoPor,
    cuenta_id: marca.registradoPor,
    credencial_id: marca.credencialId,
    dispositivo_id: marca.dispositivoId,
    hora_dispositivo: marca.horaDispositivo,
    desfase_reloj_ms: marca.desfaseRelojMs,
  };
}

/** Traduce una lista del dominio a la fila que queda pendiente de enviar. */
export function listaALocal(lista: ListaAsistencia): FilaLista {
  return {
    id: lista.id,
    ciclo_id: lista.cicloId,
    sesion_id: lista.sesionId,
    grupo_id: lista.grupoId,
    confirmada_por: lista.confirmadaPor,
    cuenta_id: lista.confirmadaPor,
    credencial_id: lista.credencialId,
    dispositivo_id: lista.dispositivoId,
    abierta_en: lista.abiertaEn,
    confirmada_en: lista.confirmadaEn,
    desfase_reloj_ms: lista.desfaseRelojMs,
    total_presentes: lista.totalPresentes,
    total_ausentes: lista.totalAusentes,
  };
}

export type ListaPendiente = {
  id: string;
  fila: FilaLista;
};

export type Pendientes = {
  marcas: MarcaPendiente[];
  listas: ListaPendiente[];
};

export const PENDIENTES_VACIOS: Pendientes = { marcas: [], listas: [] };

export type DatosMarca = {
  sesionId: string;
  cicloId: string;
  catequizandoId: string | null;
  valor: ValorAsistencia;
  tipoRegistro: TipoRegistro;
  listaId: string | null;
  registradoPor: string;
  cuentaId: string;
  credencialId: string;
  dispositivoId: string;
  horaDispositivo: string;
  desfaseRelojMs: number;
};

export function crearMarca(datos: DatosMarca): MarcaPendiente {
  return {
    id: idMarcaAsistencia(datos.sesionId, datos.catequizandoId ?? "sin-nino", datos.tipoRegistro),
    fila: {
      id: "",
      ciclo_id: datos.cicloId,
      sesion_id: datos.sesionId,
      catequizando_id: datos.catequizandoId,
      valor: datos.valor,
      tipo_registro: datos.tipoRegistro,
      lista_id: datos.listaId,
      registrado_por: datos.registradoPor,
      cuenta_id: datos.cuentaId,
      credencial_id: datos.credencialId,
      dispositivo_id: datos.dispositivoId,
      hora_dispositivo: datos.horaDispositivo,
      desfase_reloj_ms: datos.desfaseRelojMs,
    },
  };
}

/**
 * Agrega o reemplaza una marca pendiente. Como el id es determinista, volver
 * a marcar el mismo nino actualiza la fila y no crea una segunda marca.
 */
export function guardarMarca(
  pendientes: Pendientes,
  marca: MarcaPendiente
): Pendientes {
  const fila = { ...marca.fila, id: marca.id };
  const marcas = pendientes.marcas.filter((existente) => existente.id !== marca.id);
  return { ...pendientes, marcas: [...marcas, { id: marca.id, fila }] };
}

/** Cambia el valor de una marca pendiente ya guardada. */
export function alternarMarca(
  pendientes: Pendientes,
  id: string,
  valor: ValorAsistencia
): Pendientes {
  return {
    ...pendientes,
    marcas: pendientes.marcas.map((marca) =>
      marca.id === id ? { ...marca, fila: { ...marca.fila, valor } } : marca
    ),
  };
}

export function guardarLista(
  pendientes: Pendientes,
  lista: ListaPendiente
): Pendientes {
  const fila = { ...lista.fila, id: lista.id };
  const listas = pendientes.listas.filter((existente) => existente.id !== lista.id);
  return { ...pendientes, listas: [...listas, { id: lista.id, fila }] };
}

export type ResumenPendientes = {
  marcas: number;
  listas: number;
  total: number;
};
export function resumenPendientes(pendientes: Pendientes): ResumenPendientes {
  const marcas = pendientes.marcas.length;
  const listas = pendientes.listas.length;
  return { marcas, listas, total: marcas + listas };
}

/**
 * Lote para el push. Cada marca y cada lista viajan una sola vez, con las
 * columnas del servidor y sin la metadata local (_status, _changed). El
 * servidor espera las horas en milisegundos y las tablas en plural, asi que
 * aqui se convierte el formato del dispositivo al del transporte.
 */
export function prepararLote(pendientes: Pendientes): {
  marcas_asistencia: { created: Record<string, unknown>[]; updated: Record<string, unknown>[]; deleted: string[] };
  listas_asistencia: { created: Record<string, unknown>[]; updated: Record<string, unknown>[]; deleted: string[] };
} {
  return {
    marcas_asistencia: {
      created: pendientes.marcas.map((marca) => ({
        ...marca.fila,
        hora_dispositivo: Date.parse(marca.fila.hora_dispositivo),
      })),
      updated: [],
      deleted: [],
    },
    listas_asistencia: {
      created: pendientes.listas.map((lista) => ({
        ...lista.fila,
        abierta_en: Date.parse(lista.fila.abierta_en),
        confirmada_en: Date.parse(lista.fila.confirmada_en),
      })),
      updated: [],
      deleted: [],
    },
  };
}

export type ResultadoPush = {
  aceptados: number;
  rechazados: number;
  descartadosCierre: number;
};

/**
 * Retira del local lo que el servidor ya acepto. Lo demas sigue pendiente
 * para el siguiente intento, con el mismo id: reenviar no duplica.
 */
export function aplicarResultadoPush(
  pendientes: Pendientes,
  aceptados: string[]
): Pendientes {
  const aceptadas = new Set(aceptados);
  return {
    marcas: pendientes.marcas.filter((marca) => !aceptadas.has(marca.id)),
    listas: pendientes.listas.filter((lista) => !aceptadas.has(lista.id)),
  };
}
