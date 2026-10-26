import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularRiesgo } from '../compartido/riesgo.ts';

const casos: Array<{ nombre: string; asistencias: any[]; esperado: { nivel: string; contiene: string } }> = [
  {
    nombre: 'sin faltas -> BAJO',
    asistencias: [
      { fecha: '2026-10-04', estado: 'PRESENTE' },
      { fecha: '2026-10-11', estado: 'PRESENTE' },
    ],
    esperado: { nivel: 'BAJO', contiene: 'sin faltas sin justificar' },
  },
  {
    nombre: '1 falta sin justificar -> BAJO',
    asistencias: [
      { fecha: '2026-10-04', estado: 'PRESENTE' },
      { fecha: '2026-10-11', estado: 'AUSENTE' },
      { fecha: '2026-10-18', estado: 'PRESENTE' },
    ],
    esperado: { nivel: 'BAJO', contiene: '1 falta sin justificar' },
  },
  {
    nombre: '1 falta justificada no cuenta -> BAJO',
    asistencias: [
      { fecha: '2026-10-04', estado: 'AUSENTE' },
      { fecha: '2026-10-11', estado: 'JUSTIFICADA' },
      { fecha: '2026-10-18', estado: 'PRESENTE' },
    ],
    esperado: { nivel: 'BAJO', contiene: '1 falta sin justificar' },
  },
  {
    nombre: '2 faltas consecutivas sin justificar -> MEDIO',
    asistencias: [
      { fecha: '2026-10-04', estado: 'PRESENTE' },
      { fecha: '2026-10-11', estado: 'AUSENTE' },
      { fecha: '2026-10-18', estado: 'AUSENTE' },
      { fecha: '2026-10-25', estado: 'PRESENTE' },
    ],
    esperado: { nivel: 'MEDIO', contiene: '2 faltas consecutivas sin justificar' },
  },
  {
    nombre: '3 faltas consecutivas sin justificar -> ALTO',
    asistencias: [
      { fecha: '2026-10-04', estado: 'AUSENTE' },
      { fecha: '2026-10-11', estado: 'AUSENTE' },
      { fecha: '2026-10-18', estado: 'AUSENTE' },
    ],
    esperado: { nivel: 'ALTO', contiene: '3 faltas consecutivas sin justificar' },
  },
  {
    nombre: 'falta justificada no cuenta y las ausentes no son consecutivas -> BAJO',
    asistencias: [
      { fecha: '2026-10-04', estado: 'AUSENTE' },
      { fecha: '2026-10-11', estado: 'JUSTIFICADA' },
      { fecha: '2026-10-18', estado: 'AUSENTE' },
      { fecha: '2026-10-25', estado: 'PRESENTE' },
    ],
    esperado: { nivel: 'BAJO', contiene: '1 falta sin justificar' },
  },
];

for (const caso of casos) {
  test(`RF-908: ${caso.nombre}`, () => {
    const resultado = calcularRiesgo(caso.asistencias);
    assert.strictEqual(resultado.nivel, caso.esperado.nivel);
    assert.ok(resultado.motivo.includes(caso.esperado.contiene), `motivo: ${resultado.motivo}`);
  });
}
