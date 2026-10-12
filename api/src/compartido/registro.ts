export function registrar(mensaje: string, campos: { operacion?: string; codigo?: string; duracionMs?: number } = {}): void {
  const permitidos = { operacion: campos.operacion, codigo: campos.codigo, duracionMs: campos.duracionMs };
  console.info(JSON.stringify({ mensaje, ...permitidos }));
}
