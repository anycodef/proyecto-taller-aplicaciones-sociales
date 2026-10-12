export function contarPendientes(filas: { _status: string; cuenta_id: string; credencial_id?: string }[], cuentaId: string, credencialId?: string): number {
  return filas.filter(fila => ["created", "updated"].includes(fila._status) && fila.cuenta_id === cuentaId && (!credencialId || fila.credencial_id === credencialId)).length;
}
