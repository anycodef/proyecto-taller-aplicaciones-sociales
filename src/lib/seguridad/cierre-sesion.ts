export const planCierreSesion = (cuentaId: string) => [{ tipo: "purgar-excepto-pendientes", cuentaId }, { tipo: "borrar-jwt" }, { tipo: "conservar-credencial-protegida", cuentaId }] as const;
