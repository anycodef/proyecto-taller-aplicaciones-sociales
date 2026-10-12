import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { randomBytes } from "k6/crypto";

// Cada usuario usa su credencial y un lote UUID propio; el archivo vive fuera del repositorio.
const usuarios = new SharedArray("catequistas", () => JSON.parse(open(__ENV.USUARIOS_CARGA)));
export const options = {
  vus: 50, duration: "30m",
  thresholds: { "http_req_duration{operacion:push}": ["p(95)<2000"], http_req_failed: ["rate==0"], checks: ["rate==1"] },
};
let sesion;
let renovadaEn = 0;
function uuidCliente() {
  const bytes = new Uint8Array(randomBytes(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes).map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function nuevoLote(original) {
  const lote = JSON.parse(JSON.stringify(original));
  const listas = new Map();
  for (const lista of lote.changes.listas_asistencia?.created ?? []) {
    const nueva = uuidCliente();
    listas.set(lista.id, nueva);
    lista.id = nueva;
  }
  for (const marca of lote.changes.marcas_asistencia?.created ?? []) {
    marca.id = uuidCliente();
    if (marca.lista_id) marca.lista_id = listas.get(marca.lista_id) ?? marca.lista_id;
  }
  return lote;
}
export default function () {
  const usuario = usuarios[__VU - 1];
  if (!usuario || !usuario.jwt || !usuario.lote || !usuario.tokenRenovacion || !usuario.dispositivoId) throw new Error("Se requieren 50 cuentas/lotes y renovación reales en USUARIOS_CARGA");
  if (!sesion) { sesion = { jwt: usuario.jwt, tokenRenovacion: usuario.tokenRenovacion }; renovadaEn = Date.now(); }
  if (Date.now() - renovadaEn > 600000) {
    const renovacion = http.post(`${__ENV.API_URL}/acceso/renovar`, JSON.stringify({ tokenRenovacion: sesion.tokenRenovacion, dispositivoId: usuario.dispositivoId }), { headers: { "Content-Type": "application/json" }, tags: { operacion: "renovacion" } });
    check(renovacion, { "renovación 200": respuesta => respuesta.status === 200 });
    if (renovacion.status !== 200) throw new Error("No se pudo renovar la cuenta de carga");
    sesion = renovacion.json();
    renovadaEn = Date.now();
  }
  const parametros = { headers: { Authorization: `Bearer ${sesion.jwt}`, "Content-Type": "application/json" }, tags: { operacion: "push" } };
  const enviado = http.post(`${__ENV.API_URL}/sincronizacion/cambios`, JSON.stringify(nuevoLote(usuario.lote)), parametros);
  check(enviado, { "push 200 válido": respuesta => respuesta.status === 200 && respuesta.json("rechazados") === 0 });
  const recibido = http.get(`${__ENV.API_URL}/sincronizacion/cambios?versionEsquema=1`, { headers: parametros.headers, tags: { operacion: "pull" } });
  check(recibido, { "pull 200 nativo": respuesta => respuesta.status === 200 && typeof respuesta.json("timestamp") === "number" });
  sleep(5);
}
