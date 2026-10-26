import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

const POOL = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PUERTO_POSTGRES ?? process.env.PGPORT ?? 55432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? 'postgres',
  database: process.env.PGDATABASE ?? 'sigecat',
});

// Datos 100 % ficticios con identidadOperativa (RNF-901, RF-907).
const GRUPOS = [
  { id: '11111111-1111-1111-1111-111111111101', nombre: 'Primera Comunión A' },
  { id: '11111111-1111-1111-1111-111111111102', nombre: 'Confirmación B' },
];

const CATEQUIZANDOS = [
  // grupo 1 (6 niños) -> varios casos de riesgo
  { id: '22222222-2222-2222-2222-222222222101', grupo_id: GRUPOS[0].id, identidad_operativa: 'Ana García López', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222102', grupo_id: GRUPOS[0].id, identidad_operativa: 'Luis Pérez Méndez', edad: 10 },
  { id: '22222222-2222-2222-2222-222222222103', grupo_id: GRUPOS[0].id, identidad_operativa: 'Carmen Ruiz Díaz', edad: 8 },
  { id: '22222222-2222-2222-2222-222222222104', grupo_id: GRUPOS[0].id, identidad_operativa: 'Diego Torres Vega', edad: 11 },
  { id: '22222222-2222-2222-2222-222222222105', grupo_id: GRUPOS[0].id, identidad_operativa: 'Elena Suárez Castro', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222106', grupo_id: GRUPOS[0].id, identidad_operativa: 'Mateo Flores Romero', edad: 10 },
  // grupo 2 (6 niños)
  { id: '22222222-2222-2222-2222-222222222201', grupo_id: GRUPOS[1].id, identidad_operativa: 'Sofía Morales Ibarra', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222202', grupo_id: GRUPOS[1].id, identidad_operativa: 'Javier Herrera León', edad: 10 },
  { id: '22222222-2222-2222-2222-222222222203', grupo_id: GRUPOS[1].id, identidad_operativa: 'Lucía Navarro Peña', edad: 8 },
  { id: '22222222-2222-2222-2222-222222222204', grupo_id: GRUPOS[1].id, identidad_operativa: 'Pablo Muñoz Rojas', edad: 11 },
  { id: '22222222-2222-2222-2222-222222222205', grupo_id: GRUPOS[1].id, identidad_operativa: 'Carla Jiménez Vidal', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222206', grupo_id: GRUPOS[1].id, identidad_operativa: 'Tomás Castillo Ortega', edad: 10 },
];

// 6 domingos ficticios
const DOMINGOS = [
  '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08',
];
const REGISTRADO_POR = 'Coordinadora Demo - Identidad Operativa';

export async function sembrar() {
  await POOL.query('BEGIN');
  try {
    // Limpieza ordenada (respeta FK)
    await POOL.query('DELETE FROM demo_tarea3.riesgo');
    await POOL.query('DELETE FROM demo_tarea3.justificacion');
    await POOL.query('DELETE FROM demo_tarea3.asistencia');
    await POOL.query('DELETE FROM demo_tarea3.catequizando');
    await POOL.query('DELETE FROM demo_tarea3.grupo');

    for (const grupo of GRUPOS) {
      await POOL.query(
        'INSERT INTO demo_tarea3.grupo (id, nombre) VALUES ($1, $2)',
        [grupo.id, grupo.nombre]
      );
    }

    for (const c of CATEQUIZANDOS) {
      await POOL.query(
        'INSERT INTO demo_tarea3.catequizando (id, grupo_id, identidad_operativa, edad) VALUES ($1,$2,$3,$4)',
        [c.id, c.grupo_id, c.identidad_operativa, c.edad]
      );
    }

    // Diseño de asistencias para generar casos BAJO/MEDIO/ALTO.
    // - Ana (101): todas presentes -> BAJO (0 faltas)
    // - Luis (102): 2 ausentes consecutivas sin justificar -> MEDIO
    // - Carmen (103): 3 ausentes consecutivas sin justificar -> ALTO
    // - Diego (104): 1 ausente justificada -> BAJO (justificada no cuenta)
    // - Elena (105): presente siempre -> BAJO
    // - Mateo (106): 1 ausente sin justificar -> BAJO
    // Los de grupo 2: todos presentes -> BAJO
    const plan = {
      [CATEQUIZANDOS[0].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],      // BAJO
      [CATEQUIZANDOS[1].id]: ['PRESENTE','AUSENTE','AUSENTE','PRESENTE','PRESENTE','PRESENTE'],        // MEDIO (2 consecutivas)
      [CATEQUIZANDOS[2].id]: ['AUSENTE','AUSENTE','AUSENTE','PRESENTE','PRESENTE','PRESENTE'],         // ALTO (3 consecutivas)
      [CATEQUIZANDOS[3].id]: ['PRESENTE','AUSENTE','JUSTIFICADA','PRESENTE','PRESENTE','PRESENTE'],    // BAJO (justificada no cuenta)
      [CATEQUIZANDOS[4].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],      // BAJO
      [CATEQUIZANDOS[5].id]: ['PRESENTE','PRESENTE','AUSENTE','PRESENTE','PRESENTE','PRESENTE'],       // BAJO (1 falta)
      [CATEQUIZANDOS[6].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],      // BAJO
      [CATEQUIZANDOS[7].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],      // BAJO
      [CATEQUIZANDOS[8].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],      // BAJO
      [CATEQUIZANDOS[9].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],      // BAJO
      [CATEQUIZANDOS[10].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],     // BAJO
      [CATEQUIZANDOS[11].id]: ['PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE','PRESENTE'],     // BAJO
    };

    for (const c of CATEQUIZANDOS) {
      const estados = plan[c.id];
      for (let i = 0; i < DOMINGOS.length; i++) {
        await POOL.query(
          `INSERT INTO demo_tarea3.asistencia (id, catequizando_id, fecha, estado, registrado_por)
           VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), c.id, DOMINGOS[i], estados[i], REGISTRADO_POR]
        );
      }
    }

    await POOL.query('COMMIT');
    console.log('[bd:sembrar] siembra ficticia completada: 2 grupos, 12 catequizandos, 6 domingos');
  } catch (error) {
    await POOL.query('ROLLBACK');
    throw error;
  } finally {
    await POOL.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('bd-sembrar.mjs')) {
  sembrar().catch((error) => {
    console.error('[bd:sembrar] error:', error.message);
    process.exit(1);
  });
}
