export type ErrorHttp = Error & { estado: number; codigo: string };

function crearErrorHttp(estado: number, codigo: string): ErrorHttp {
  const error = new Error(codigo) as ErrorHttp;
  error.estado = estado;
  error.codigo = codigo;
  return error;
}

export type ClienteHttpOpciones = {
  urlBase: string;
  claveSuscripcion?: string;
  obtenerToken: () => Promise<string | null>;
  renovarSesion: () => Promise<string | null>;
  irASinAcceso: (rechazados: number) => void;
  contarPendientes?: () => number;
  fetchImpl?: typeof fetch;
  enDesarrollo?: boolean;
};

/** Foto ya comprimida: viaja como binario, nunca como JSON ni en base64 (RF-402). */
export type DatosBinarios = Blob | ArrayBuffer | Uint8Array;

export type ClienteHttp = {
  solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T>;
  solicitarBinario<T>(metodo: string, ruta: string, datos: DatosBinarios, contentType: string): Promise<T>;
};

type Carga = { tipo: "json"; cuerpo: unknown } | { tipo: "binario"; datos: DatosBinarios; contentType: string };

function codigoDe(cuerpo: unknown): string {
  if (cuerpo && typeof cuerpo === "object" && "codigo" in cuerpo) {
    const codigo = (cuerpo as { codigo: unknown }).codigo;
    if (typeof codigo === "string") return codigo;
  }
  return "error_desconocido";
}

/**
 * Cliente HTTP del app: inyecta el JWT y la clave de suscripcion de APIM,
 * renueva una sola vez ante un 401 y reintenta, y lleva a la pantalla de
 * acceso denegado cuando la credencial ya no sirve (RF-101, RNF-103).
 */
export function crearClienteHttp(opciones: ClienteHttpOpciones): ClienteHttp {
  const {
    urlBase,
    claveSuscripcion,
    obtenerToken,
    renovarSesion,
    irASinAcceso,
    contarPendientes = () => 0,
    enDesarrollo = false,
  } = opciones;
  const pedir = opciones.fetchImpl ?? fetch;

  if (!enDesarrollo && !urlBase.startsWith("https://")) throw new Error("url_base_insegura");

  async function cuerpoDe(respuesta: Response): Promise<unknown> {
    try {
      return await respuesta.json();
    } catch {
      return null;
    }
  }

  async function enviar(
    metodo: string,
    ruta: string,
    carga: Carga,
    token: string | null
  ): Promise<Response> {
    const cabeceras: Record<string, string> = { accept: "application/json" };
    if (carga.tipo === "binario") cabeceras["content-type"] = carga.contentType;
    else if (carga.cuerpo !== undefined) cabeceras["content-type"] = "application/json";
    if (token) cabeceras.authorization = `Bearer ${token}`;
    if (claveSuscripcion) cabeceras["ocp-apim-subscription-key"] = claveSuscripcion;
    const cuerpo = carga.tipo === "binario" ? carga.datos : carga.cuerpo === undefined ? undefined : JSON.stringify(carga.cuerpo);
    return pedir(`${urlBase}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      ...(cuerpo === undefined ? {} : { body: cuerpo as BodyInit }),
    });
  }

  async function ejecutar<T>(metodo: string, ruta: string, carga: Carga): Promise<T> {
    const token = await obtenerToken();
    let respuesta = await enviar(metodo, ruta, carga, token);

    if (respuesta.status === 401) {
      const cuerpoError = await cuerpoDe(respuesta);
      const codigo = codigoDe(cuerpoError);

      if (codigo === "credencial_terminada") {
        irASinAcceso(contarPendientes());
        throw crearErrorHttp(401, codigo);
      }

      const tokenRenovado = await renovarSesion();
      if (!tokenRenovado) throw crearErrorHttp(401, codigo);

      respuesta = await enviar(metodo, ruta, carga, tokenRenovado);
      if (respuesta.status === 401) throw crearErrorHttp(401, codigoDe(await cuerpoDe(respuesta)));
    }

    if (!respuesta.ok) throw crearErrorHttp(respuesta.status, codigoDe(await cuerpoDe(respuesta)));

    return (await cuerpoDe(respuesta)) as T;
  }

  const solicitar = <T>(metodo: string, ruta: string, cuerpo?: unknown) => ejecutar<T>(metodo, ruta, { tipo: "json", cuerpo });
  const solicitarBinario = <T>(metodo: string, ruta: string, datos: DatosBinarios, contentType: string) =>
    ejecutar<T>(metodo, ruta, { tipo: "binario", datos, contentType });

  return { solicitar, solicitarBinario };
}
