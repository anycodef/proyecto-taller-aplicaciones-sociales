import { RegistroRepositorio } from "../src/domain/RegistroRepositorio";
import { SesionRepositorio } from "../src/domain/SesionRepositorio";
import { abrirBaseSqlite } from "../src/infrastructure/baseSqlite";
import { RegistroRepositorioEnMemoria } from "../src/infrastructure/RegistroRepositorioEnMemoria";
import { RegistroRepositorioSqlite } from "../src/infrastructure/RegistroRepositorioSqlite";
import { SesionRepositorioEnMemoria } from "../src/infrastructure/SesionRepositorioEnMemoria";
import { SesionRepositorioSqlite } from "../src/infrastructure/SesionRepositorioSqlite";

export type Almacen = { sesiones: SesionRepositorio; registros: RegistroRepositorio };

/** Cada prueba de contrato se ejecuta contra todas las implementaciones (principio L). */
export const ALMACENES: ReadonlyArray<{ nombre: string; crear: () => Almacen }> = [
  {
    nombre: "memoria",
    crear: () => ({ sesiones: new SesionRepositorioEnMemoria(), registros: new RegistroRepositorioEnMemoria() }),
  },
  {
    nombre: "sqlite",
    crear: () => {
      const db = abrirBaseSqlite(":memory:");
      return { sesiones: new SesionRepositorioSqlite(db), registros: new RegistroRepositorioSqlite(db) };
    },
  },
];
