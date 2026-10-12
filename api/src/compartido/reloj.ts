export interface Reloj { ahora(): Date }
export const relojSistema: Reloj = { ahora: () => new Date() };
