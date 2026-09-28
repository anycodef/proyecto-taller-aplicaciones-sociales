/** Puerto para la fecha actual: la edad depende de "hoy" y las pruebas deben poder fijarla. */
export interface Reloj {
  ahora(): Date;
}
