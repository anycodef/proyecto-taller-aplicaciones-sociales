import { crearApiRiesgo } from "../api";

test("RF-707: listarRiesgo pide GET /riesgo y devuelve la lista tal como la calcula el servidor", async () => {
  const llamadas: { metodo: string; ruta: string }[] = [];
  const lista = [{ catequizandoId: "n1", nombre: "Niño ficticio", grupoId: "g", grupoNombre: "Grupo demo", paso: "contacto", conteo: 2, sinFicha: true, pendientesJustificar: 0, faltasOrigen: [] }];
  const api = crearApiRiesgo({
    solicitar: async <T,>(metodo: string, ruta: string) => {
      llamadas.push({ metodo, ruta });
      return lista as T;
    },
  });
  expect(await api.listarRiesgo()).toEqual(lista);
  expect(llamadas).toEqual([{ metodo: "GET", ruta: "/riesgo" }]);
});

test("RF-707: un catequista sin alcance recibe el error 403 del servidor sin que el cliente lo oculte", async () => {
  const api = crearApiRiesgo({
    solicitar: async () => {
      throw Object.assign(new Error("fuera_de_alcance"), { estado: 403, codigo: "fuera_de_alcance" });
    },
  });
  await expect(api.listarRiesgo()).rejects.toMatchObject({ estado: 403 });
});
