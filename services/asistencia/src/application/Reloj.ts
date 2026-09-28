/** Fuente de tiempo inyectable: permite probar el cálculo sin depender de la hora real. */
export type Reloj = () => Date;

export const relojDelSistema: Reloj = () => new Date();
