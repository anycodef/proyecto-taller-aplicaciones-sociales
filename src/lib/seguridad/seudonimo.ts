export type IdentidadReal = { nombres: string; apellidos: string; fechaNacimiento?: string };
export const nombreVisible = (cuenta: { identidadOperativa: string }): string => cuenta.identidadOperativa;
export function validarAlta(datos: { esMenor: boolean; identidadOperativa: string; identidadReal?: IdentidadReal }): boolean {
  const nombre = datos.identidadOperativa.trim();
  return nombre.length > 0 && (!datos.esMenor || !datos.identidadReal || nombre.toLocaleLowerCase() !== `${datos.identidadReal.nombres} ${datos.identidadReal.apellidos}`.trim().toLocaleLowerCase());
}
export function esMenorAlInicioDeCiclo(nacimiento: string, inicio: string): boolean {
  const fecha = new Date(`${nacimiento}T00:00:00Z`);
  fecha.setUTCFullYear(fecha.getUTCFullYear() + 18);
  return fecha.getTime() > Date.parse(`${inicio}T00:00:00Z`);
}
