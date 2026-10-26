import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitirToken } from '../../compartido/auth.ts';
import { crearAplicacion } from '../aplicacion.ts';
import { crearDatos, nivelesDesde } from '../datos.ts';
import { crearEjecutorEspia, levantarServidor } from './ayuda.ts';
import { CATEQUIZANDOS, GRUPOS, PLAN_ASISTENCIAS, RIESGOS } from './siembra-prueba.ts';

// El domingo 3 de la siembra (indice 2) reparte PRESENTE, AUSENTE y JUSTIFICADA.
const DOMINGO = '2026-10-18';
const INDICE_DOMINGO = 2;

function conteosEsperados(grupoId: string) {
  const conteos = { presentes: 0, ausentes: 0, justificadas: 0, tardanzas: 0 };
  for (const catequizando of CATEQUIZANDOS) {
    if (catequizando.grupoId !== grupoId) continue;
    const estado = PLAN_ASISTENCIAS[catequizando.id][INDICE_DOMINGO];
    if (estado === 'PRESENTE') conteos.presentes += 1;
    else if (estado === 'AUSENTE') conteos.ausentes += 1;
    else if (estado === 'JUSTIFICADA') conteos.justificadas += 1;
    else if (estado === 'TARDANZA') conteos.tardanzas += 1;
  }
  return conteos;
}

function responder(texto: string, valores: unknown[]): Record<string, unknown>[] {
  if (texto.includes('GROUP BY a.estado')) {
    const [grupoId, fecha] = valores as [string, string];
    assert.strictEqual(fecha, DOMINGO, 'la fecha debe llegar tal cual al SQL');
    const conteos = conteosEsperados(grupoId);
    return [
      { estado: 'PRESENTE', cuantas: conteos.presentes },
      { estado: 'AUSENTE', cuantas: conteos.ausentes },
      { estado: 'JUSTIFICADA', cuantas: conteos.justificadas },
      { estado: 'TARDANZA', cuantas: conteos.tardanzas },
    ].filter(({ cuantas }) => cuantas > 0);
  }

  if (texto.includes('FROM demo_tarea3.riesgo r')) {
    const [grupoId, niveles] = valores as [string, string[]];
    const delGrupo = new Set(
      CATEQUIZANDOS.filter((c) => c.grupoId === grupoId).map((c) => c.id)
    );
    return RIESGOS.filter((r) => delGrupo.has(r.catequizandoId) && niveles.includes(r.nivel))
      .map((r) => ({
        catequizando_id: r.catequizandoId,
        nivel: r.nivel,
        motivo: r.motivo,
        calculado_en: '2026-11-09T10:00:00.000Z',
      }))
      // El SQL ordena por nivel descendente; el doble lo imita.
      .sort((a, b) => niveles.indexOf(b.nivel) - niveles.indexOf(a.nivel));
  }

  throw new Error(`consulta no prevista por el doble: ${texto}`);
}

async function servidorConEspia() {
  const espia = crearEjecutorEspia(responder);
  const servidor = await levantarServidor(crearAplicacion({ datos: crearDatos(espia) }));
  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
  return { espia, servidor, token };
}

test('RF-902: nivelesDesde incluye el nivel pedido y los de arriba', () => {
  assert.deepStrictEqual(nivelesDesde('BAJO'), ['BAJO', 'MEDIO', 'ALTO']);
  assert.deepStrictEqual(nivelesDesde('MEDIO'), ['MEDIO', 'ALTO']);
  assert.deepStrictEqual(nivelesDesde('ALTO'), ['ALTO']);
});

test('RF-902: asistenciaDelDomingo cuenta por estado y en una sola consulta', async (t) => {
  const { espia, servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { estado, cuerpo } = await servidor.consultar(
    `query($grupoId: ID!, $fecha: FechaCivil!) {
       asistenciaDelDomingo(grupoId: $grupoId, fecha: $fecha) {
         fecha presentes ausentes justificadas tardanzas
       }
     }`,
    { grupoId: GRUPOS[0].id, fecha: DOMINGO },
    token
  );

  assert.strictEqual(estado, 200);
  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const esperado = conteosEsperados(GRUPOS[0].id);
  assert.deepStrictEqual(cuerpo.data!.asistenciaDelDomingo, {
    fecha: DOMINGO,
    presentes: esperado.presentes,
    ausentes: esperado.ausentes,
    justificadas: esperado.justificadas,
    tardanzas: esperado.tardanzas,
  });
  // El conteo lo hace PostgreSQL; el servicio no trae las filas para sumarlas.
  assert.strictEqual(espia.consultas.length, 1);
});

test('RF-902: un domingo sin registros devuelve ceros, no error', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!, $fecha: FechaCivil!) {
       asistenciaDelDomingo(grupoId: $grupoId, fecha: $fecha) { presentes ausentes }
     }`,
    { grupoId: '11111111-1111-1111-1111-111111119999', fecha: DOMINGO },
    token
  );
  assert.strictEqual(cuerpo.errors, undefined);
  assert.deepStrictEqual(cuerpo.data!.asistenciaDelDomingo, { presentes: 0, ausentes: 0 });
});

test('RF-902: una fecha que no es AAAA-MM-DD la rechaza el escalar del contrato', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!, $fecha: FechaCivil!) {
       asistenciaDelDomingo(grupoId: $grupoId, fecha: $fecha) { presentes }
     }`,
    { grupoId: GRUPOS[0].id, fecha: '18/10/2026' },
    token
  );
  assert.ok(cuerpo.errors?.length, 'debe rechazarse antes de llegar al SQL');
  assert.match(JSON.stringify(cuerpo.errors), /AAAA-MM-DD/);
});

test('RF-902: riesgoDelGrupo filtra por nivelMinimo y ordena de mayor a menor', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const consulta = `query($grupoId: ID!, $nivelMinimo: NivelRiesgo) {
    riesgoDelGrupo(grupoId: $grupoId, nivelMinimo: $nivelMinimo) {
      catequizandoId nivel motivo calculadoEn
    }
  }`;

  // Por defecto el contrato pide MEDIO: deja fuera los BAJO de la siembra.
  const porDefecto = await servidor.consultar(consulta, { grupoId: GRUPOS[0].id }, token);
  const niveles = (porDefecto.cuerpo.data!.riesgoDelGrupo as { nivel: string }[]).map(
    (r) => r.nivel
  );
  assert.deepStrictEqual(niveles, ['ALTO', 'MEDIO']);

  const todos = await servidor.consultar(
    consulta,
    { grupoId: GRUPOS[0].id, nivelMinimo: 'BAJO' },
    token
  );
  const nivelesTodos = (todos.cuerpo.data!.riesgoDelGrupo as { nivel: string }[]).map(
    (r) => r.nivel
  );
  assert.strictEqual(nivelesTodos.length, 4, 'con BAJO entran los cuatro riesgos sembrados');
  assert.strictEqual(nivelesTodos[0], 'ALTO');

  const soloAltos = await servidor.consultar(
    consulta,
    { grupoId: GRUPOS[0].id, nivelMinimo: 'ALTO' },
    token
  );
  const nivelesAltos = (soloAltos.cuerpo.data!.riesgoDelGrupo as { nivel: string }[]).map(
    (r) => r.nivel
  );
  assert.deepStrictEqual(nivelesAltos, ['ALTO']);
});

test('RF-902: el motivo del riesgo viaja tal cual lo calculo P3', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) { riesgoDelGrupo(grupoId: $grupoId) { nivel motivo } }`,
    { grupoId: GRUPOS[0].id },
    token
  );
  const riesgos = cuerpo.data!.riesgoDelGrupo as { nivel: string; motivo: string }[];
  const alto = riesgos.find((r) => r.nivel === 'ALTO');
  assert.strictEqual(alto?.motivo, '3 faltas consecutivas sin justificar');
});

test('RF-906: CAT no consulta el domingo ni el riesgo de otro grupo', async (t) => {
  const { servidor } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const tokenCat = await emitirToken({
    rol: 'CAT',
    grupoId: GRUPOS[0].id,
    identidadOperativa: 'Catequista Demo',
    sub: '99999999-9999-9999-9999-999999999901',
  });

  const domingoAjeno = await servidor.consultar(
    `query($grupoId: ID!, $fecha: FechaCivil!) {
       asistenciaDelDomingo(grupoId: $grupoId, fecha: $fecha) { presentes }
     }`,
    { grupoId: GRUPOS[1].id, fecha: DOMINGO },
    tokenCat
  );
  assert.strictEqual(domingoAjeno.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');

  const riesgoAjeno = await servidor.consultar(
    `query($grupoId: ID!) { riesgoDelGrupo(grupoId: $grupoId) { nivel } }`,
    { grupoId: GRUPOS[1].id },
    tokenCat
  );
  assert.strictEqual(riesgoAjeno.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-906: SUP lee el riesgo de cualquier grupo', async (t) => {
  const { servidor } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const tokenSup = await emitirToken({
    rol: 'SUP',
    identidadOperativa: 'Supervision Demo',
    sub: '99999999-9999-9999-9999-999999999904',
  });
  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) { riesgoDelGrupo(grupoId: $grupoId) { nivel } }`,
    { grupoId: GRUPOS[1].id },
    tokenSup
  );
  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
});
