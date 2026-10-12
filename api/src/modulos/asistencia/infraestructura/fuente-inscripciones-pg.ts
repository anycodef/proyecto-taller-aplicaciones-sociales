import type { FuenteInscripciones } from "../dominio/puertos";
import { fuenteInscripciones } from "../../catequizandos/aplicacion/consultas";
// El adaptador lee únicamente la proyección operacional de 002; no concede acceso HTTP.
export const fuenteInscripcionesPg: FuenteInscripciones = {
  async activosEnFecha(cicloId, fecha, tx) {
    const resultado = await tx.query<{ id: string; nombre: string }>(`SELECT n.id,n.nombres || ' ' || n.apellidos AS nombre
      FROM catequizando n WHERE n.estado<>'anonimizado' AND EXISTS(SELECT 1 FROM inscripcion i WHERE i.catequizando_id=n.id AND i.ciclo_id=$1)
      ORDER BY n.id FOR SHARE OF n`, [cicloId]);
    const periodos = await fuenteInscripciones.periodos(cicloId, resultado.rows.map(fila => fila.id), tx);
    const fechaLima = (instante: string): string => new Date(Date.parse(instante) - 5 * 3600000).toISOString().slice(0, 10);
    const vigente = (periodo: { desde: string; hasta: string | null }): boolean => fechaLima(periodo.desde) <= fecha && (periodo.hasta === null || fechaLima(periodo.hasta) > fecha);
    return resultado.rows.flatMap(fila => {
      const periodo = periodos.filter(periodo => periodo.catequizandoId === fila.id && vigente(periodo)).at(-1);
      const asignacion = periodo?.asignaciones.filter(vigente).at(-1);
      return asignacion ? [{ catequizandoId: fila.id, grupoId: asignacion.grupoId, nombre: fila.nombre }] : [];
    });
  },
};
let fuente: FuenteInscripciones = fuenteInscripcionesPg;
export function registrarFuenteInscripciones(puerto: FuenteInscripciones): void { fuente = puerto; }
export const obtenerFuenteInscripciones = (): FuenteInscripciones => fuente;
