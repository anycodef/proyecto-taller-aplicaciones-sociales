export const INTENTOS_MAXIMOS = 5;
export type EstadoPin = { intentosFallidos: number; bloqueada: boolean };
export const validarFormatoPin = (pin: string): boolean => pin.length >= 4 && pin.length <= 6 && !/[^0-9]/.test(pin);
export async function verificadorPin(pin: string, sal: string, hash: (valor: string) => Promise<string>): Promise<string> {
  if (!validarFormatoPin(pin) || !sal) throw new Error("pin_invalido");
  return hash(`${sal}:${pin}`);
}
export function registrarIntento(estado: EstadoPin, correcto: boolean): EstadoPin {
  if (estado.bloqueada) return { ...estado };
  const intentosFallidos = correcto ? 0 : estado.intentosFallidos + 1;
  return { intentosFallidos, bloqueada: intentosFallidos >= INTENTOS_MAXIMOS };
}
