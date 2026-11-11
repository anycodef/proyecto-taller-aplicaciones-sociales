import type { EntradaProveedor, ProveedorRespuesta, SalidaProveedor } from "./tipos";

export class ProveedorExtractivo implements ProveedorRespuesta {
  async generar({ fragmentos }: EntradaProveedor): Promise<SalidaProveedor> {
    const usados = fragmentos.slice(0, 3);
    const texto = [
      "Según el material público de catequesis:",
      ...usados.map((fragmento) => `${fragmento.texto} [${fragmento.documento}, ${fragmento.seccion}]`),
    ].join("\n\n");

    return { texto, proveedor: "extractivo", modelo: "extractivo-1" };
  }
}
