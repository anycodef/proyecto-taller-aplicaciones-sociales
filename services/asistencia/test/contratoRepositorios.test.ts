import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RegistroAsistencia } from "../src/domain/RegistroAsistencia";
import { SesionCatequesis } from "../src/domain/SesionCatequesis";
import { ALMACENES } from "./almacenes";

const registro = (id: string, catequizandoId: string, estado: RegistroAsistencia["estado"], sesionId = "s1"): RegistroAsistencia => ({
  id,
  sesionId,
  catequizandoId,
  estado,
  registradoPor: "C1",
  registradoEn: "2026-09-27T10:00:00.000Z",
});

for (const { nombre, crear } of ALMACENES) {
  describe(`contrato de repositorios — ${nombre}`, () => {
    it("guarda y recupera una sesión, con y sin tema", async () => {
      const { sesiones } = crear();
      const conTema: SesionCatequesis = { id: "s1", grupoId: "grp-8", fecha: "2026-09-27", tipo: "catequesis", tema: "El Padrenuestro" };
      const sinTema: SesionCatequesis = { id: "s2", grupoId: "grp-8", fecha: "2026-09-27", tipo: "misa" };
      await sesiones.guardar(conTema);
      await sesiones.guardar(sinTema);
      const halladas = await sesiones.buscarPorIds(["s1", "s2", "no-existe"]);
      assert.deepEqual(halladas.sort((a, b) => a.id.localeCompare(b.id)), [conTema, sinTema]);
      assert.ok(!("tema" in halladas.find((s) => s.id === "s2")!), "sin tema no debe traer la clave");
    });

    it("guardar la misma sesión dos veces deja una sola (upsert por id)", async () => {
      const { sesiones } = crear();
      await sesiones.guardar({ id: "s1", grupoId: "grp-8", fecha: "2026-09-27", tipo: "misa" });
      await sesiones.guardar({ id: "s1", grupoId: "grp-9", fecha: "2026-09-20", tipo: "catequesis", tema: "Nuevo" });
      assert.deepEqual(await sesiones.buscarPorIds(["s1"]), [
        { id: "s1", grupoId: "grp-9", fecha: "2026-09-20", tipo: "catequesis", tema: "Nuevo" },
      ]);
    });

    it("buscarPorIds tolera lista vacía y ids repetidos", async () => {
      const { sesiones } = crear();
      await sesiones.guardar({ id: "s1", grupoId: "grp-8", fecha: "2026-09-27", tipo: "misa" });
      assert.deepEqual(await sesiones.buscarPorIds([]), []);
      assert.equal((await sesiones.buscarPorIds(["s1", "s1"])).length, 1);
    });

    it("reenviar el mismo lote de registros no duplica (idempotencia por id)", async () => {
      const { registros } = crear();
      const lote = [registro("r1", "cat-001", "presente"), registro("r2", "cat-002", "ausente")];
      await registros.guardarVarios(lote);
      await registros.guardarVarios(lote);
      assert.deepEqual(await registros.listarPorCatequizando("cat-001"), [lote[0]]);
      assert.deepEqual(await registros.listarPorCatequizando("cat-002"), [lote[1]]);
    });

    it("mismo id con otro estado reemplaza, no agrega", async () => {
      const { registros } = crear();
      await registros.guardarVarios([registro("r1", "cat-001", "ausente")]);
      await registros.guardarVarios([registro("r1", "cat-001", "justificado")]);
      const lista = await registros.listarPorCatequizando("cat-001");
      assert.equal(lista.length, 1);
      assert.equal(lista[0]!.estado, "justificado");
    });

    it("lista solo los registros del catequizando pedido; desconocido → []", async () => {
      const { registros } = crear();
      await registros.guardarVarios([registro("r1", "cat-001", "presente"), registro("r2", "cat-002", "presente")]);
      assert.equal((await registros.listarPorCatequizando("cat-001")).length, 1);
      assert.deepEqual(await registros.listarPorCatequizando("cat-999"), []);
    });

    it("conserva todos los campos del registro", async () => {
      const { registros } = crear();
      const original = registro("r1", "cat-001", "tardanza", "sesion-x");
      await registros.guardarVarios([original]);
      assert.deepEqual(await registros.listarPorCatequizando("cat-001"), [original]);
    });
  });
}
