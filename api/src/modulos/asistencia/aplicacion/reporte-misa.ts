import { enTransaccion } from "../../../compartido/bd/transaccion";
import { consolidar } from "@/lib/asistencia/consolidacion";
import { armarReporteMisa } from "@/lib/asistencia/reporte-misa";
import { obtenerFuenteInscripciones } from "../infraestructura/fuente-inscripciones-pg";
import { leerCorrecciones, leerMarcas } from "../infraestructura/repositorio-pg";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
export async function reporteMisa(fecha: string) {
  return enTransaccion(async tx => {
    const sesion = await tx.query<{ id: string; ciclo_id: string; cancelada: boolean }>("SELECT s.id,s.ciclo_id,s.cancelada FROM sesion s JOIN ciclo c ON c.id=s.ciclo_id WHERE s.fecha=$1 AND s.tipo='misa' AND s.eliminado_en IS NULL ORDER BY c.inicio DESC LIMIT 1", [fecha]);
    if (!sesion.rowCount) throw new ErrorAplicacion(404, "sesion_no_disponible");
    const fila = sesion.rows[0];
    const activos = await obtenerFuenteInscripciones().activosEnFecha(fila.ciclo_id, fecha, tx);
    const presentes = await tx.query<{ catequizando_id: string; nombre: string }>(`SELECT a.catequizando_id,n.nombres || ' ' || n.apellidos AS nombre
      FROM asistencia a JOIN catequizando n ON n.id=a.catequizando_id WHERE a.sesion_id=$1 AND a.valor='presente' AND a.eliminado_en IS NULL AND n.estado<>'anonimizado' ORDER BY n.apellidos,n.nombres`, [fila.id]);
    const identidades = await tx.query<{ id: string; identidad_operativa: string }>("SELECT id,identidad_operativa FROM cuenta");
    const consolidadas = [];
    for (const nino of presentes.rows) {
      const consolidada = consolidar(await leerMarcas(fila.id, nino.catequizando_id, tx), await leerCorrecciones(fila.id, nino.catequizando_id, tx));
      if (consolidada) consolidadas.push({ ...consolidada, catequizandoId: nino.catequizando_id, nombre: nino.nombre });
    }
    return { fecha, cancelada: fila.cancelada, ...armarReporteMisa(fila.cancelada ? [] : consolidadas, activos.length, id => identidades.rows.find(cuenta => cuenta.id === id)?.identidad_operativa ?? "Registrador retirado") };
  });
}
