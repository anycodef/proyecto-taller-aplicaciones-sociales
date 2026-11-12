import { crearApiCatequizandos, prepararInscripcion } from "@/lib/catequizandos/api";
import type { PeticionInscripcion } from "@/lib/catequizandos/contratos";

type Llamada = { metodo: string; ruta: string; cuerpo?: unknown };

function crearClienteFalso() {
  const llamadas: Llamada[] = [];
  const cliente = {
    solicitar: async <T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> => {
      llamadas.push({ metodo, ruta, cuerpo });
      if (ruta === "/inscripciones") throw new Error("sin_conexion");
      return {} as T;
    },
  };
  return { cliente, llamadas };
}

const datos: Omit<PeticionInscripcion, "id"> = {
  nino: {
    id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    nombres: "Mateo",
    apellidos: "Vargas",
    fechaNacimiento: "2016-05-04",
    sexo: "masculino",
    bautizado: true,
  },
  apoderados: [
    {
      id: "apoderado-1",
      apoderado: {
        id: "apoderado-1",
        nombres: "Lucia",
        apellidos: "Vargas",
        tipoContacto: "telefono",
        valorContacto: "999999999",
        cuentaId: "cuenta-apoderado",
        credencialId: "credencial-apoderado",
      },
      relacion: "madre",
    },
  ],
  grupoId: "grupo-1",
  asignacionId: "asignacion-1",
  documentos: [
    { id: "documento-1", tipo: "documento_identidad" },
    { id: "documento-2", tipo: "partida_nacimiento" },
    { id: "documento-3", tipo: "partida_bautismo" },
    { id: "documento-4", tipo: "boleta_pago" },
    { id: "documento-5", tipo: "ficha_compromiso" },
  ],
  edadFueraRangoConfirmada: false,
};

test("RF-202: inscribir envía el UUID generado en el cliente y reintenta con el mismo", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  const api = crearApiCatequizandos(cliente);

  const prepared = prepararInscripcion(datos, () => "3f2504e0-4f89-41d3-9a0c-0305e82c3301");

  await expect(api.inscribir(prepared)).rejects.toThrow("sin_conexion");
  await expect(api.inscribir(prepared)).rejects.toThrow("sin_conexion");

  expect(llamadas).toHaveLength(2);
  expect(llamadas[0].cuerpo).toMatchObject({ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });
  expect(llamadas[1].cuerpo).toMatchObject({ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });
  expect((llamadas[0].cuerpo as PeticionInscripcion).id).toBe((llamadas[1].cuerpo as PeticionInscripcion).id);
});

test("RF-206: cicloAbierto lee el ciclo del contrato { ciclo } y devuelve null si no hay ciclo abierto", async () => {
  const ciclo = { id: "c1", nombre: "2026", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", estado: "abierto" as const };
  const conCiclo = crearApiCatequizandos({ solicitar: async <T,>() => ({ ciclo }) as T });
  expect(await conCiclo.cicloAbierto()).toEqual(ciclo);
  const sinCiclo = crearApiCatequizandos({ solicitar: async <T,>() => ({ ciclo: null }) as T });
  expect(await sinCiclo.cicloAbierto()).toBeNull();
});
