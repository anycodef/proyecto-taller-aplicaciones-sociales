import type { Rol } from "@/lib/seguridad/contexto-acceso";

/** Puerto minimo que necesita la API. La plataforma aporta la implementacion. */
export type ClienteHttp = {
  solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T>;
};

export type Cuenta = {
  id: string;
  identidadOperativa: string;
  esMenor: boolean;
  activa: boolean;
  roles: Rol[];
};

export type AltaCuenta = {
  id: string;
  identidadOperativa: string;
  esMenor: boolean;
  roles: Rol[];
  identidadReal?: { nombres: string; apellidos: string; fechaNacimiento?: string };
};

export type UrlEnlace = { url: string };

export type AvisoCoordinacion = {
  id: string;
  tipo: string;
  cuentaRelacionadaId: string;
  identidadOperativa: string;
  cantidad: number;
  creadoEn: string;
  leidoEn: string | null;
};

export type Delegacion = {
  id: string;
  deleganteId: string;
  delegadoId: string;
  deleganteVisible: string;
  delegadoVisible: string;
  desde: string;
  hasta: string;
  revocadaEn: string | null;
};

export type TextoConsentimiento = {
  id: string;
  version: string;
  contenido: string;
  contenidoSha256: string;
  incluyeClausulaConstancia: boolean;
  vigenteDesde: string;
};

export type EventoAuditoria = {
  id: string;
  ocurridoEn: string;
  cuentaId: string | null;
  autorVisible: string | null;
  accion: string;
  recursoTipo: string | null;
  recursoId: string | null;
  catequizandoId: string | null;
  resultado: "permitido" | "denegado";
  detalle: Record<string, unknown>;
};

export type ApiSeguridad = {
  listarCuentas(): Promise<Cuenta[]>;
  leerCuenta(id: string): Promise<Cuenta>;
  crearCuenta(datos: AltaCuenta): Promise<{ id: string }>;
  emitirEnlace(cuentaId: string, tipo: "equipo" | "familia"): Promise<UrlEnlace>;
  revocarEnlace(cuentaId: string): Promise<void>;
  listarAvisos(): Promise<AvisoCoordinacion[]>;
  marcarAvisoLeido(avisoId: string): Promise<void>;
  listarDelegaciones(): Promise<Delegacion[]>;
  crearDelegacion(datos: {
    id: string;
    delegadoId: string;
    desde: string;
    hasta: string;
  }): Promise<{ id: string }>;
  revocarDelegacion(delegacionId: string): Promise<void>;
  textoConsentimientoVigente(): Promise<TextoConsentimiento | null>;
  consultarAuditoria(filtros: {
    catequizandoId?: string;
    desde?: string;
    hasta?: string;
  }): Promise<EventoAuditoria[]>;
};

export function crearApiSeguridad(cliente: ClienteHttp): ApiSeguridad {
  return {
    listarCuentas: async () => {
      const respuesta = await cliente.solicitar<{ cuentas: Cuenta[] }>("GET", "/cuentas");
      return respuesta.cuentas;
    },
    leerCuenta: (id) => cliente.solicitar<Cuenta>("GET", `/cuentas/${encodeURIComponent(id)}`),
    crearCuenta: (datos) => cliente.solicitar<{ id: string }>("POST", "/cuentas", datos),
    emitirEnlace: (cuentaId, tipo) =>
      cliente.solicitar<UrlEnlace>("POST", `/cuentas/${encodeURIComponent(cuentaId)}/enlaces`, { tipo }),
    revocarEnlace: (cuentaId) =>
      cliente.solicitar<void>("POST", `/cuentas/${encodeURIComponent(cuentaId)}/enlaces/revocar`, {}),
    listarAvisos: async () => {
      const respuesta = await cliente.solicitar<{ avisos: AvisoCoordinacion[] }>("GET", "/avisos-coordinacion");
      return respuesta.avisos;
    },
    marcarAvisoLeido: (avisoId) =>
      cliente.solicitar<void>("POST", `/avisos-coordinacion/${encodeURIComponent(avisoId)}/leido`, {}),
    listarDelegaciones: async () => {
      const respuesta = await cliente.solicitar<{ delegaciones: Delegacion[] }>("GET", "/delegaciones");
      return respuesta.delegaciones;
    },
    crearDelegacion: (datos) => cliente.solicitar<{ id: string }>("POST", "/delegaciones", datos),
    revocarDelegacion: (delegacionId) =>
      cliente.solicitar<void>("POST", `/delegaciones/${encodeURIComponent(delegacionId)}/revocar`, {}),
    textoConsentimientoVigente: () =>
      cliente.solicitar<TextoConsentimiento | null>("GET", "/consentimientos/texto-vigente"),
    consultarAuditoria: (filtros) => {
      const consulta = new URLSearchParams();
      if (filtros.catequizandoId) consulta.set("catequizandoId", filtros.catequizandoId);
      if (filtros.desde) consulta.set("desde", filtros.desde);
      if (filtros.hasta) consulta.set("hasta", filtros.hasta);
      const sufijo = consulta.toString();
      return cliente
        .solicitar<{ eventos: EventoAuditoria[] }>("GET", `/auditoria${sufijo ? `?${sufijo}` : ""}`)
        .then((respuesta) => respuesta.eventos);
    },
  };
}
