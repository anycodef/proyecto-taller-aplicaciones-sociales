import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const destino = join(process.env.RUNNER_TEMP, 'paquete-api');
const paquete = JSON.parse(readFileSync('api/package.json', 'utf8'));
if (paquete.main !== 'dist/index.js') {
  throw new Error('El contrato Functions v4 exige main=dist/index.js; revisar la integracion del API.');
}
mkdirSync(destino, { recursive: true });
cpSync('api/dist', join(destino, 'dist'), { recursive: true });
cpSync('api/host.json', join(destino, 'host.json'));
cpSync('api/node_modules', join(destino, 'node_modules'), { recursive: true });
writeFileSync(join(destino, 'package.json'), JSON.stringify({ ...paquete, scripts: {}, devDependencies: {} }));
