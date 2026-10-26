// Conjunto de datos de las pruebas de P2 (100 % ficticio, RNF-901).
//
// Reproduce el mismo conjunto que scripts/bd-sembrar.mjs de P5: mismos UUID,
// mismos domingos y mismos casos BAJO/MEDIO/ALTO, para que lo que se prueba
// sea lo que se vera en la demo. No se importa de P5 porque esa siembra hoy no
// corre (depende del paquete `uuid`, que no esta declarado en
// tarea3/package.json ni instalado) y es archivo suyo, que no se toca.
//
// No contiene salud, neurodivergencia ni documentos (RF-907).

export const GRUPOS = [
  { id: '11111111-1111-1111-1111-111111111101', nombre: 'Primera Comunión A' },
  { id: '11111111-1111-1111-1111-111111111102', nombre: 'Confirmación B' },
] as const;

export const CATEQUIZANDOS = [
  { id: '22222222-2222-2222-2222-222222222101', grupoId: GRUPOS[0].id, identidadOperativa: 'Ana García López', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222102', grupoId: GRUPOS[0].id, identidadOperativa: 'Luis Pérez Méndez', edad: 10 },
  { id: '22222222-2222-2222-2222-222222222103', grupoId: GRUPOS[0].id, identidadOperativa: 'Carmen Ruiz Díaz', edad: 8 },
  { id: '22222222-2222-2222-2222-222222222104', grupoId: GRUPOS[0].id, identidadOperativa: 'Diego Torres Vega', edad: 11 },
  { id: '22222222-2222-2222-2222-222222222105', grupoId: GRUPOS[0].id, identidadOperativa: 'Elena Suárez Castro', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222106', grupoId: GRUPOS[0].id, identidadOperativa: 'Mateo Flores Romero', edad: 10 },
  { id: '22222222-2222-2222-2222-222222222201', grupoId: GRUPOS[1].id, identidadOperativa: 'Sofía Morales Ibarra', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222202', grupoId: GRUPOS[1].id, identidadOperativa: 'Javier Herrera León', edad: 10 },
  { id: '22222222-2222-2222-2222-222222222203', grupoId: GRUPOS[1].id, identidadOperativa: 'Lucía Navarro Peña', edad: 8 },
  { id: '22222222-2222-2222-2222-222222222204', grupoId: GRUPOS[1].id, identidadOperativa: 'Pablo Muñoz Rojas', edad: 11 },
  { id: '22222222-2222-2222-2222-222222222205', grupoId: GRUPOS[1].id, identidadOperativa: 'Carla Jiménez Vidal', edad: 9 },
  { id: '22222222-2222-2222-2222-222222222206', grupoId: GRUPOS[1].id, identidadOperativa: 'Tomás Castillo Ortega', edad: 10 },
] as const;

export const DOMINGOS = [
  '2026-10-04',
  '2026-10-11',
  '2026-10-18',
  '2026-10-25',
  '2026-11-01',
  '2026-11-08',
] as const;

export const REGISTRADO_POR = 'Coordinadora Demo - Identidad Operativa';

// Mismo diseño que la siembra de P5: Ana BAJO, Luis MEDIO (2 consecutivas),
// Carmen ALTO (3 consecutivas), Diego BAJO (la justificada no cuenta).
export const PLAN_ASISTENCIAS: Record<string, string[]> = {
  [CATEQUIZANDOS[0].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[1].id]: ['PRESENTE', 'AUSENTE', 'AUSENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[2].id]: ['AUSENTE', 'AUSENTE', 'AUSENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[3].id]: ['PRESENTE', 'AUSENTE', 'JUSTIFICADA', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[4].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[5].id]: ['PRESENTE', 'PRESENTE', 'AUSENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[6].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'TARDANZA'],
  [CATEQUIZANDOS[7].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[8].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[9].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[10].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
  [CATEQUIZANDOS[11].id]: ['PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE', 'PRESENTE'],
};

// Riesgo ya calculado por el servicio de P3 en la demo; la consulta solo lo lee.
export const RIESGOS = [
  { catequizandoId: CATEQUIZANDOS[0].id, nivel: 'BAJO', motivo: 'sin faltas sin justificar' },
  { catequizandoId: CATEQUIZANDOS[1].id, nivel: 'MEDIO', motivo: '2 faltas consecutivas sin justificar' },
  { catequizandoId: CATEQUIZANDOS[2].id, nivel: 'ALTO', motivo: '3 faltas consecutivas sin justificar' },
  { catequizandoId: CATEQUIZANDOS[3].id, nivel: 'BAJO', motivo: '1 falta sin justificar' },
] as const;
