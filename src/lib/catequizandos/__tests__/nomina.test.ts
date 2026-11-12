import { agruparNomina } from "../nomina";

const grupos = [
  { id: "g2", nombre: "Grupo B", es_mio: false },
  { id: "g1", nombre: "Grupo A", es_mio: true },
  { id: "g3", nombre: "Grupo vacío", es_mio: true },
];
const ninos = [
  { id: "n1", nombres: "Zoe", apellidos: "Ramos", grupo_id: "g1" },
  { id: "n2", nombres: "Ángel", apellidos: "Pérez", grupo_id: "g1" },
  { id: "n3", nombres: "Luis", apellidos: "Soto", grupo_id: "g2" },
  { id: "n4", nombres: "Retirado", apellidos: "Uno", grupo_id: "g1", activo: false },
];

test("RNF-306: la nómina se agrupa con los grupos del catequista primero y sin grupos vacíos", () => {
  expect(agruparNomina(grupos, ninos).map((g) => [g.nombre, g.esMio])).toEqual([["Grupo A", true], ["Grupo B", false]]);
});

test("RNF-306: los niños salen por nombre y los inactivos no aparecen", () => {
  expect(agruparNomina(grupos, ninos)[0].ninos.map((n) => n.nombres)).toEqual(["Ángel", "Zoe"]);
});

test("RNF-306: la búsqueda ignora tildes y mayúsculas y oculta los grupos sin coincidencias", () => {
  const resultado = agruparNomina(grupos, ninos, "angel");
  expect(resultado).toHaveLength(1);
  expect(resultado[0].ninos.map((n) => n.id)).toEqual(["n2"]);
  expect(agruparNomina(grupos, ninos, "SOTO")[0].nombre).toBe("Grupo B");
  expect(agruparNomina(grupos, ninos, "zzz")).toEqual([]);
});
