// Arranque del servicio de consulta GraphQL en el puerto 4000 (spec 009, plan §6).
// scripts/demo.mjs lo lanza a través de index.mjs y espera a que /salud responda.

import { pool } from '../compartido/bd.ts';
import { crearAplicacion } from './aplicacion.ts';
import { crearDatos, type EjecutorSql } from './datos.ts';
import { crearServidor, PUERTO_PREDETERMINADO } from './servidor.ts';

const puerto = Number(process.env.PUERTO_CONSULTA ?? PUERTO_PREDETERMINADO);

const ejecutor: EjecutorSql = { query: (texto, valores) => pool.query(texto, valores) };

const servidor = crearServidor(crearAplicacion({ datos: crearDatos(ejecutor) }));

servidor.listen(puerto, '127.0.0.1', () => {
  console.log(`[servicio-consulta] escuchando en http://127.0.0.1:${puerto}/graphql`);
});

function cerrar(senal: string): void {
  console.log(`[servicio-consulta] ${senal}: cerrando`);
  servidor.close(() => process.exit(0));
}

process.on('SIGTERM', () => cerrar('SIGTERM'));
process.on('SIGINT', () => cerrar('SIGINT'));
