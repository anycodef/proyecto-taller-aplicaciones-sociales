import { emitirToken } from '../compartido/auth.ts';

// npm --prefix tarea3 run token -- --rol CAT --grupo <uuid> --identidad <nombre> --sub <uuid>
// Imprime un JWT HS256 de demostración para probar los servicios.

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split('=');
    return [k.replace(/^--/, ''), v];
  })
);

const rol = args.rol || 'COORD';
const grupoId = args.grupo || undefined;
const identidadOperativa = args.identidad || 'Demo Operativo';
const sub = args.sub || crypto.randomUUID();

emitirToken({ rol, grupoId, identidadOperativa, sub })
  .then((token) => {
    console.log(token);
  })
  .catch((error) => {
    console.error('[token] error:', error.message);
    process.exit(1);
  });
