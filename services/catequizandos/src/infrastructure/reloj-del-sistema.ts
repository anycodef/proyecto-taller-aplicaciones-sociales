import type { Reloj } from "../domain/reloj";

export class RelojDelSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}
