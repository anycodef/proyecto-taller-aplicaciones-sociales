import { configuracionBaseDatos } from "../../../src/compartido/config";
import { registrar } from "../../../src/compartido/registro";

test("RF-101 RNF-103: configuración inválida falla nombrando variable sin revelar valor", () => {
  const anterior = process.env.BD_URL;
  try {
    process.env.BD_URL = "https://no-es-postgresql.invalid/secreto";
    expect(() => configuracionBaseDatos()).toThrow("BD_URL debe ser una URL PostgreSQL válida");
  } finally { if (anterior === undefined) delete process.env.BD_URL; else process.env.BD_URL = anterior; }
});
test("RNF-101: el registrador elimina cuerpos y datos restringidos de propiedades inesperadas", () => {
  const salida = jest.spyOn(console, "info").mockImplementation(() => {});
  try {
    registrar("operacion", { codigo: "ok", cuerpo: "datos privados", salud: "dato restringido" } as { codigo: string });
    expect(salida).toHaveBeenCalledWith(JSON.stringify({ mensaje: "operacion", codigo: "ok" }));
  } finally { salida.mockRestore(); }
});
