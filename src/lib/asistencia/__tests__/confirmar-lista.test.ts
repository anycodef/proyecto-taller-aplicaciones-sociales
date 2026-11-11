import { confirmarListaEnLocal } from "@/lib/asistencia/confirmar-lista";
import { abrirLista, type BorradorLista } from "@/lib/asistencia/lista";
import { idListaAsistencia, idMarcaAsistencia } from "@/lib/asistencia/pendientes";
import type { FilaLista, FilaMarca } from "@/lib/asistencia/pendientes";
import {
  idBorradorLista,
  type ConfirmarListaLocal,
  type RepositorioAsistencia,
} from "@/lib/asistencia/repositorio-asistencia";
import type { Sesion } from "@/lib/asistencia/tipos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";

const sesion: Sesion = {
  id: "11111111-1111-4111-8111-111111111111",
  cicloId: "22222222-2222-4222-8222-222222222222",
  fecha: "2026-10-18",
  tipo: "catequesis",
  actividadId: null,
  cancelada: false,
  ventanaInicio: null,
  ventanaFin: null,
};

const ninoA = "33333333-3333-4333-8333-333333333333";
const ninoB = "44444444-4444-4444-8444-444444444444";

const cuenta: ContextoAcceso = {
  cuentaId: "55555555-5555-4555-8555-555555555555",
  credencialId: "66666666-6666-4666-8666-666666666666",
  dispositivoId: "77777777-7777-4777-8777-777777777777",
  rolesPropios: ["catequista"],
  gruposAsignados: ["grupo-1"],
  catequizandosApoderados: [],
  identidadOperativa: "Luz",
  esMenor: true,
};

type RepositorioFalso = {
  repositorio: RepositorioAsistencia;
  confirmaciones: ConfirmarListaLocal[];
  borradores: Map<string, BorradorLista>;
};

function repositorioFalso(): RepositorioFalso {
  const confirmaciones: ConfirmarListaLocal[] = [];
  const borradores = new Map<string, BorradorLista>();
  const repositorio: RepositorioAsistencia = {
    ninosActivos: () => [],
    ninosDeGrupos: () => [],
    sesiones: () => [sesion],
    leerBorrador: (borradorId) => borradores.get(borradorId) ?? null,
    guardarBorrador: (borradorId, borrador) => {
      borradores.set(borradorId, borrador);
    },
    registrarMarca: () => undefined,
    confirmarLista: (entrada) => {
      confirmaciones.push(entrada);
      borradores.delete(entrada.borradorId);
    },
  };
  return { repositorio, confirmaciones, borradores };
}

function confirmar(grupoId: string, repositorio: RepositorioAsistencia, cuentaUsada = cuenta) {
  return confirmarListaEnLocal({
    repositorio,
    cuenta: cuentaUsada,
    sesion,
    grupoId,
    borrador: { ...abrirLista([{ id: ninoA }, { id: ninoB }]), [ninoB]: "ausente" },
    abiertaEn: "2026-10-18T14:55:00.000Z",
    hora: "2026-10-18T15:00:00.000Z",
    desfaseRelojMs: 0,
  });
}

test("RF-306: confirmar crea la lista y las marcas y borra el borrador en una sola transaccion", () => {
  const { repositorio, confirmaciones, borradores } = repositorioFalso();
  const borradorId = idBorradorLista(sesion.id, "grupo-1");
  repositorio.guardarBorrador(borradorId, { [ninoA]: "presente", [ninoB]: "ausente" });

  const resultado = confirmar("grupo-1", repositorio);

  expect(confirmaciones).toHaveLength(1);
  expect(borradores.has(borradorId)).toBe(false);
  expect(resultado.lista.id).toBe(idListaAsistencia(sesion.id, "grupo-1"));
  expect(resultado.lista.total_presentes).toBe(1);
  expect(resultado.lista.total_ausentes).toBe(1);
  expect(resultado.marcas).toHaveLength(2);
  expect(resultado.marcas.map((marca) => marca.id).sort()).toEqual(
    [idMarcaAsistencia(sesion.id, ninoA, "lista"), idMarcaAsistencia(sesion.id, ninoB, "lista")].sort()
  );
  expect(resultado.marcas.every((marca) => marca.lista_id === resultado.lista.id)).toBe(true);
  expect(resultado.marcas.every((marca) => marca.hora_dispositivo === resultado.lista.confirmada_en)).toBe(true);
  expect(resultado.marcas.every((marca) => marca.tipo_registro === "lista")).toBe(true);
});

test("RF-306: un catequista confirma desde la app la lista de un grupo que no es suyo", () => {
  const { repositorio, confirmaciones } = repositorioFalso();

  const resultado = confirmar("grupo-ajeno", repositorio);

  expect(confirmaciones).toHaveLength(1);
  expect(resultado.lista.grupo_id).toBe("grupo-ajeno");
  expect(resultado.lista.confirmada_por).toBe(cuenta.cuentaId);
});

test("RF-307: confirmar dos veces la misma lista no crea marcas nuevas", () => {
  const { repositorio } = repositorioFalso();

  const primera = confirmar("grupo-1", repositorio);
  const segunda = confirmar("grupo-1", repositorio);

  expect(segunda.lista.id).toBe(primera.lista.id);
  expect(segunda.marcas.map((marca) => marca.id)).toEqual(primera.marcas.map((marca) => marca.id));
});

test("RF-307: sin dispositivo identificado la lista no se confirma", () => {
  const { repositorio, confirmaciones } = repositorioFalso();
  const sinDispositivo = { ...cuenta, dispositivoId: undefined };

  expect(() => confirmar("grupo-1", repositorio, sinDispositivo)).toThrow();
  expect(confirmaciones).toHaveLength(0);
});

test("RF-306: la lista de una sesion de misa no se confirma", () => {
  const { repositorio, confirmaciones } = repositorioFalso();
  const misa: Sesion = { ...sesion, tipo: "misa" };

  expect(() =>
    confirmarListaEnLocal({
      repositorio,
      cuenta,
      sesion: misa,
      grupoId: "grupo-1",
      borrador: abrirLista([{ id: ninoA }]),
      abiertaEn: "2026-10-18T14:55:00.000Z",
      hora: "2026-10-18T15:00:00.000Z",
      desfaseRelojMs: 0,
    })
  ).toThrow();
  expect(confirmaciones).toHaveLength(0);
});

test("RF-307: la fila de la lista y la de sus marcas llevan los datos de la cuenta", () => {
  const { repositorio } = repositorioFalso();

  const resultado = confirmar("grupo-1", repositorio);
  const lista: FilaLista = resultado.lista;
  const marcas: FilaMarca[] = resultado.marcas;

  expect(lista.cuenta_id).toBe(cuenta.cuentaId);
  expect(lista.credencial_id).toBe(cuenta.credencialId);
  expect(lista.dispositivo_id).toBe(cuenta.dispositivoId);
  expect(lista.sesion_id).toBe(sesion.id);
  expect(lista.ciclo_id).toBe(sesion.cicloId);
  expect(marcas.every((marca) => marca.cuenta_id === cuenta.cuentaId)).toBe(true);
  expect(marcas.every((marca) => marca.dispositivo_id === cuenta.dispositivoId)).toBe(true);
});
