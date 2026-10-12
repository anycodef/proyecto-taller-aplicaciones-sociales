export const RELACIONES = ["madre", "padre", "otro_familiar", "tutor"] as const;
export const validarVinculo = (vinculo: { relacion: string; detalleRelacion?: string }): boolean => RELACIONES.some(r => r === vinculo.relacion) && (!vinculo.detalleRelacion || vinculo.detalleRelacion.length <= 100);
export const efectoDesvinculacion = (restantes: number): "quitar_alcance_nino" | "revocar_enlace" => restantes > 0 ? "quitar_alcance_nino" : "revocar_enlace";
