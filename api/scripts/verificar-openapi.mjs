import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, dirname } from "node:path";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const errores = [];
const exigir = (condicion, mensaje) => { if (!condicion) errores.push(mensaje); };
const documento = JSON.parse(await readFile(resolve(raiz, "api/openapi.json"), "utf8"));
const metodos = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const tipos = new Set(["object", "array", "string", "integer", "number", "boolean", "null"]);
const palabrasSchema = new Set(["$ref", "type", "format", "description", "title", "properties", "required", "additionalProperties", "propertyNames", "items", "minItems", "maxItems", "uniqueItems", "minProperties", "maxProperties", "minLength", "maxLength", "pattern", "minimum", "maximum", "enum", "const", "oneOf", "anyOf", "allOf", "examples", "default", "readOnly", "writeOnly", "unevaluatedProperties"]);

function referencia(ref) {
  exigir(typeof ref === "string" && ref.startsWith("#/"), `Referencia no local: ${ref}`);
  if (typeof ref !== "string" || !ref.startsWith("#/")) return {};
  let valor = documento;
  for (const parte of ref.slice(2).split("/")) valor = valor?.[parte.replace(/~1/g, "/").replace(/~0/g, "~")];
  exigir(valor !== undefined, `Referencia inexistente: ${ref}`);
  return valor ?? {};
}
function expandir(objeto) { return objeto?.$ref ? { ...referencia(objeto.$ref), ...Object.fromEntries(Object.entries(objeto).filter(([k]) => k !== "$ref")) } : objeto; }
function recorrer(valor, ruta, visitar) {
  if (!valor || typeof valor !== "object") return;
  visitar(valor, ruta);
  for (const [clave, hijo] of Object.entries(valor)) recorrer(hijo, `${ruta}/${clave}`, visitar);
}
function tipoValido(valor, tipo) {
  if (tipo === "null") return valor === null;
  if (tipo === "array") return Array.isArray(valor);
  if (tipo === "object") return valor !== null && typeof valor === "object" && !Array.isArray(valor);
  if (tipo === "integer") return Number.isSafeInteger(valor);
  if (tipo === "number") return typeof valor === "number" && Number.isFinite(valor);
  return typeof valor === tipo;
}
// Verifica el subconjunto explícito utilizado por este contrato; no finge validar toda la meta-spec OpenAPI.
function validarValor(valor, origen, ruta) {
  const s = expandir(origen);
  const fallos = [];
  const fallo = mensaje => fallos.push(`${ruta}: ${mensaje}`);
  for (const combinador of ["oneOf", "anyOf", "allOf"]) if (s[combinador]) {
    const coincidencias = s[combinador].filter(v => validarValor(valor, v, ruta).length === 0).length;
    if ((combinador === "oneOf" && coincidencias !== 1) || (combinador === "anyOf" && coincidencias === 0) || (combinador === "allOf" && coincidencias !== s[combinador].length)) fallo(`${combinador} no coincide`);
  }
  if (s.type && !(Array.isArray(s.type) ? s.type : [s.type]).some(t => tipoValido(valor, t))) { fallo(`tipo esperado ${s.type}`); return fallos; }
  if (s.enum && !s.enum.some(v => JSON.stringify(v) === JSON.stringify(valor))) fallo("fuera de enum");
  if (Object.hasOwn(s, "const") && JSON.stringify(s.const) !== JSON.stringify(valor)) fallo("const no coincide");
  if (typeof valor === "string") {
    const largo = [...valor].length;
    if (s.minLength !== undefined && largo < s.minLength) fallo("minLength");
    if (s.maxLength !== undefined && largo > s.maxLength) fallo("maxLength");
    if (s.pattern && !new RegExp(s.pattern, "u").test(valor)) fallo("pattern");
    if (s.format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) fallo("UUID");
    if (s.format === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(Date.parse(`${valor}T00:00:00Z`)) || new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) !== valor)) fallo("fecha civil");
    if (s.format === "date-time" && (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(valor) || !Number.isFinite(Date.parse(valor)))) fallo("instante con zona");
    if (s.format === "uri") { try { new URL(valor); } catch { fallo("URI absoluta"); } }
  }
  if (typeof valor === "number") {
    if (s.minimum !== undefined && valor < s.minimum) fallo("minimum");
    if (s.maximum !== undefined && valor > s.maximum) fallo("maximum");
  }
  if (Array.isArray(valor)) {
    if (s.minItems !== undefined && valor.length < s.minItems) fallo("minItems");
    if (s.maxItems !== undefined && valor.length > s.maxItems) fallo("maxItems");
    if (s.uniqueItems && new Set(valor.map(v => JSON.stringify(v))).size !== valor.length) fallo("uniqueItems");
    if (s.items) valor.forEach((v, i) => fallos.push(...validarValor(v, s.items, `${ruta}/${i}`)));
  }
  if (tipoValido(valor, "object")) {
    if (s.minProperties !== undefined && Object.keys(valor).length < s.minProperties) fallo("minProperties");
    for (const clave of s.required ?? []) if (!Object.hasOwn(valor, clave)) fallo(`falta ${clave}`);
    for (const [clave, v] of Object.entries(valor)) {
      if (s.propertyNames) fallos.push(...validarValor(clave, s.propertyNames, `${ruta}/${clave}`));
      if (s.properties?.[clave]) fallos.push(...validarValor(v, s.properties[clave], `${ruta}/${clave}`));
      else if (s.additionalProperties === false) fallo(`campo desconocido ${clave}`);
      else if (s.additionalProperties && typeof s.additionalProperties === "object") fallos.push(...validarValor(v, s.additionalProperties, `${ruta}/${clave}`));
    }
  }
  return fallos;
}
const schemasVisitados = new Set();
function revisarSchema(origen, ruta) {
  if (!origen || typeof origen !== "object") { exigir(false, `${ruta}: schema ausente`); return; }
  if (origen.$ref) { referencia(origen.$ref); return; }
  if (schemasVisitados.has(origen)) return;
  schemasVisitados.add(origen);
  for (const clave of Object.keys(origen)) exigir(palabrasSchema.has(clave) || clave.startsWith("x-"), `${ruta}: palabra schema no verificada ${clave}`);
  exigir(origen.type || origen.oneOf || origen.anyOf || origen.allOf, `${ruta}: falta tipo o composición`);
  if (origen.type) for (const tipo of Array.isArray(origen.type) ? origen.type : [origen.type]) exigir(tipos.has(tipo), `${ruta}: tipo inválido ${tipo}`);
  const contiene = tipo => (Array.isArray(origen.type) ? origen.type : [origen.type]).includes(tipo);
  if (contiene("object") && !origen["x-json-dinamico"]) {
    exigir(origen.additionalProperties === false || (origen["x-mapa-dinamico"] && typeof origen.additionalProperties === "object"), `${ruta}: objeto debe ser cerrado o mapa tipado explícito`);
    for (const requerido of origen.required ?? []) exigir(Object.hasOwn(origen.properties ?? {}, requerido), `${ruta}: required sin propiedad ${requerido}`);
    for (const [clave, schema] of Object.entries(origen.properties ?? {})) revisarSchema(schema, `${ruta}/properties/${clave}`);
    if (typeof origen.additionalProperties === "object") revisarSchema(origen.additionalProperties, `${ruta}/additionalProperties`);
    if (origen.propertyNames) revisarSchema(origen.propertyNames, `${ruta}/propertyNames`);
  }
  if (contiene("array") && !origen["x-json-dinamico"]) { exigir(origen.items, `${ruta}: array sin items`); revisarSchema(origen.items, `${ruta}/items`); }
  for (const combinador of ["oneOf", "anyOf", "allOf"]) origen[combinador]?.forEach((s, i) => revisarSchema(s, `${ruta}/${combinador}/${i}`));
  if (origen.pattern) { try { new RegExp(origen.pattern, "u"); } catch { exigir(false, `${ruta}: regex inválida`); } }
  for (const ejemplo of origen.examples ?? []) errores.push(...validarValor(ejemplo, origen, `${ruta}/examples`));
  if (Object.hasOwn(origen, "default")) errores.push(...validarValor(origen.default, origen, `${ruta}/default`));
}
function revisarContenido(contenido, ruta) {
  exigir(contenido && Object.keys(contenido).length, `${ruta}: falta content`);
  for (const [tipo, media] of Object.entries(contenido ?? {})) {
    exigir(tipo === "application/json", `${ruta}: media type inesperado ${tipo}`);
    revisarSchema(media.schema, `${ruta}/schema`);
    if (Object.hasOwn(media, "example")) errores.push(...validarValor(media.example, media.schema, `${ruta}/example`));
    for (const [nombre, ejemplo] of Object.entries(media.examples ?? {})) errores.push(...validarValor(expandir(ejemplo).value, media.schema, `${ruta}/examples/${nombre}`));
  }
}

exigir(documento.openapi === "3.1.0", "Se exige OpenAPI 3.1.0");
exigir(documento.info?.title && documento.info?.version, "Falta info");
recorrer(documento, "#", (v, ruta) => { if (v.$ref) referencia(v.$ref); if (v.default && /clave|token|password|secret/i.test(ruta)) exigir(false, `${ruta}: secreto predeterminado prohibido`); });
for (const [nombre, schema] of Object.entries(documento.components?.schemas ?? {})) revisarSchema(schema, `schemas/${nombre}`);
const operaciones = new Set();
const ids = new Set();
for (const [ruta, item] of Object.entries(documento.paths ?? {})) {
  exigir(ruta.startsWith("/") && !ruta.includes("?"), `Ruta inválida ${ruta}`);
  for (const [metodo, operacion] of Object.entries(item)) {
    if (metodo === "parameters" || metodo.startsWith("x-")) continue;
    exigir(metodos.has(metodo), `${ruta}: método inválido ${metodo}`);
    if (!metodos.has(metodo)) continue;
    operaciones.add(`${metodo.toUpperCase()} ${ruta}`);
    exigir(operacion.operationId && !ids.has(operacion.operationId), `${ruta}: operationId ausente/duplicado`);
    ids.add(operacion.operationId);
    exigir(operacion.summary, `${ruta}: falta summary`);
    const parametros = [...(item.parameters ?? []), ...(operacion.parameters ?? [])].map(expandir);
    const nombres = parametros.map(p => `${p.in}:${p.name}`);
    exigir(new Set(nombres).size === nombres.length, `${ruta}: parámetros duplicados`);
    const marcadores = [...ruta.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
    for (const nombre of marcadores) exigir(parametros.some(p => p.in === "path" && p.name === nombre && p.required === true), `${ruta}: falta parámetro path ${nombre}`);
    for (const p of parametros) {
      exigir(["query", "path", "header", "cookie"].includes(p.in), `${ruta}: ubicación inválida ${p.name}`);
      exigir(Boolean(p.schema) !== Boolean(p.content), `${ruta}: parámetro ${p.name} requiere schema o content`);
      if (p.in === "path") exigir(marcadores.includes(p.name) && p.required, `${ruta}: path sobrante/opcional ${p.name}`);
      if (p.schema) { revisarSchema(p.schema, `${ruta}/${p.name}`); if (Object.hasOwn(p, "example")) errores.push(...validarValor(p.example, p.schema, `${ruta}/${p.name}/example`)); }
      if (p.content) revisarContenido(p.content, `${ruta}/${p.name}`);
    }
    if (operacion.requestBody) revisarContenido(expandir(operacion.requestBody).content, `${ruta}/requestBody`);
    exigir(Object.keys(operacion.responses ?? {}).some(e => /^2\d\d$/.test(e)), `${ruta}: falta respuesta exitosa`);
    for (const [estado, respuesta] of Object.entries(operacion.responses ?? {})) {
      exigir(/^[1-5]\d\d$/.test(estado), `${ruta}: estado inválido ${estado}`);
      const r = expandir(respuesta);
      exigir(r.description, `${ruta}/${estado}: falta descripción`);
      revisarContenido(r.content, `${ruta}/${estado}`);
      for (const [nombre, encabezado] of Object.entries(r.headers ?? {})) revisarSchema(expandir(encabezado).schema, `${ruta}/${estado}/headers/${nombre}`);
    }
    for (const requisito of operacion.security ?? documento.security ?? []) for (const nombre of Object.keys(requisito)) exigir(documento.components.securitySchemes[nombre], `${ruta}: esquema de seguridad desconocido ${nombre}`);
  }
}

async function archivos(carpeta) {
  const resultado = [];
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    const ruta = resolve(carpeta, entrada.name);
    if (entrada.isDirectory()) resultado.push(...await archivos(ruta));
    else if (entrada.name.endsWith(".ts")) resultado.push(ruta);
  }
  return resultado;
}
const fuentes = await archivos(resolve(raiz, "api/src"));
const rutasCodigo = new Set();
const variablesCodigo = new Set();
for (const archivo of fuentes) {
  const texto = await readFile(archivo, "utf8");
  for (const match of texto.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) variablesCodigo.add(match[1]);
  if (!texto.includes("app.http(")) continue;
  const anteriores = rutasCodigo.size;
  for (const match of texto.matchAll(/\[\s*["']\w+["']\s*,\s*["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*["']([^"']+)["']\s*\]/g)) rutasCodigo.add(`${match[1]} /${match[2]}`);
  for (const match of texto.matchAll(/app\.http\([^,]+,\s*\{([\s\S]*?)\bhandler\s*:/g)) {
    const ruta = match[1].match(/\broute:\s*["']([^"']+)["']/)?.[1];
    const lista = match[1].match(/\bmethods:\s*\[([^\]]+)\]/)?.[1];
    if (ruta && lista) for (const metodo of lista.matchAll(/["'](GET|POST|PUT|PATCH|DELETE)["']/g)) rutasCodigo.add(`${metodo[1]} /${ruta}`);
  }
  // El registro de canjes de seguridad usa tuplas nombre/ruta y POST fijo.
  for (const match of texto.matchAll(/\[\s*["']\w+["']\s*,\s*["'](acceso\/[^"']+)["']\s*\]/g)) rutasCodigo.add(`POST /${match[1]}`);
  exigir(rutasCodigo.size > anteriores, `Registro HTTP sin formato reconocido: ${relative(raiz, archivo)}`);
}
for (const ruta of rutasCodigo) exigir(operaciones.has(ruta), `Falta operación de código: ${ruta}`);
for (const ruta of operaciones) exigir(rutasCodigo.has(ruta), `Operación documentada sin registro actual: ${ruta}`);
for (const fuente of documento["x-fuentes"] ?? []) { try { exigir((await stat(resolve(raiz, fuente))).isFile(), `Fuente no es archivo: ${fuente}`); } catch { exigir(false, `Fuente inexistente: ${fuente}`); } }
const config = documento["x-configuracion"];
const variables = new Set([...config.variables, ...Object.keys(config.aliasCompatibles)]);
for (const nombre of variablesCodigo) exigir(variables.has(nombre), `Variable runtime no documentada: ${nombre}`);
exigir(config.aliasCompatibles.WEB_URL === "URL_WEB", "Alias WEB_URL debe apuntar a URL_WEB");
exigir(config.puertoPostgres.variable === "PUERTO_POSTGRES" && config.puertoPostgres.predeterminadoLocal === 55432, "Puerto PostgreSQL local incorrecto");
exigir(config.poolPorProceso === 3 && config.workers === 1 && config.instanciasPorGrupoFlex === 5 && config.concurrenciaHttp === 10 && config.memoriaMb === 2048 && config.alwaysReady === 0 && config.temporizadores === "UTC", "Configuración Flex divergente");
const composicion = await readFile(resolve(raiz, "api/docker-compose.yml"), "utf8");
exigir(composicion.includes("${PUERTO_POSTGRES:-55432}"), "Docker Compose no conserva puerto configurable 55432");
const muestra = JSON.parse(await readFile(resolve(raiz, "api/local.settings.example.json"), "utf8"));
for (const nombre of Object.keys(muestra.Values)) exigir(variables.has(nombre), `Configuración ejemplo no documentada: ${nombre}`);
const tsconfig = JSON.parse(await readFile(resolve(raiz, "api/tsconfig.json"), "utf8"));
exigir(tsconfig.compilerOptions.strict === true && tsconfig.compilerOptions.paths?.["@/lib/*"]?.includes("../src/lib/*"), "Alias/tipado API debe resolver @/lib/* al dominio compartido");
exigir(tsconfig.compilerOptions.types.includes("node"), "API requiere tipos Node justificados en spec001");

function cuerpoObjeto(texto, nombre) {
  const patron = new RegExp(`\\b${nombre}\\s*=\\s*(?:z\\.preprocess\\(\\s*ignorarMetadatosLocales\\s*,\\s*)?(?:z\\.object\\(\\s*)?\\{`, "g");
  const encontrado = patron.exec(texto);
  if (!encontrado) return null;
  const inicio = patron.lastIndex - 1;
  let profundidad = 0, comilla = "", escape = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === comilla) comilla = "";
      continue;
    }
    if (["'", '"', "`"].includes(c)) { comilla = c; continue; }
    if (c === "{") profundidad++;
    if (c === "}" && --profundidad === 0) return texto.slice(inicio + 1, i);
  }
  return null;
}
function camposObjeto(texto, nombre, vistos = new Set()) {
  if (vistos.has(nombre)) throw new Error(`Expansión cíclica de Zod: ${nombre}`);
  const cuerpo = cuerpoObjeto(texto, nombre);
  if (cuerpo === null) {
    const referenciaObjeto = texto.match(new RegExp(`\\b${nombre}\\s*=\\s*z\\.object\\(\\s*(\\w+)\\s*\\)([^;\\n]*)`));
    if (!referenciaObjeto) return null;
    const base = camposObjeto(texto, referenciaObjeto[1], new Set([...vistos, nombre]));
    return base && { campos: base.campos, obligatorios: referenciaObjeto[2].includes(".partial()") ? [] : base.obligatorios };
  }
  const partes = [];
  let inicio = 0, profundidad = 0, comilla = "", escape = false;
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i];
    if (comilla) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === comilla) comilla = "";
      continue;
    }
    if (["'", '"', "`"].includes(c)) { comilla = c; continue; }
    if ("({[".includes(c)) profundidad++;
    if (")}]".includes(c)) profundidad--;
    if (c === "," && profundidad === 0) { partes.push(cuerpo.slice(inicio, i).trim()); inicio = i + 1; }
  }
  partes.push(cuerpo.slice(inicio).trim());
  const declarados = new Map();
  for (const parte of partes.filter(Boolean)) {
    const expansion = parte.match(/^\.\.\.(\w+)$/)?.[1];
    if (expansion) {
      const sub = camposObjeto(texto, expansion, new Set([...vistos, nombre]));
      exigir(sub, `No se puede resolver spread ${nombre}.${expansion}`);
      if (sub) for (const clave of sub.campos) declarados.set(clave, sub.obligatorios.includes(clave));
      continue;
    }
    const clave = parte.match(/^(\w+)\s*(?::|$)/)?.[1];
    exigir(clave, `Campo Zod no reconocido en ${nombre}: ${parte.slice(0, 60)}`);
    if (clave) declarados.set(clave, !/\.(?:optional|default)\([^)]*\)\s*$/.test(parte));
  }
  return { campos: [...declarados.keys()], obligatorios: [...declarados].filter(([, requerido]) => requerido).map(([clave]) => clave) };
}
const comparacionesDto = {
  "api/src/modulos/catequizandos/http/esquemas.ts": {
    nino: "Nino", apoderado: "ApoderadoNuevo", inscripcion: "Inscripcion", confirmarDuplicado: "ConfirmarDuplicado",
    grupo: "AltaGrupo", editarGrupo: "EditarGrupo", asignar: "AsignarGrupo", catequistas: "Catequistas", sugerencia: "Sugerencia",
    anular: "Anular", documento: "CambiarDocumento", condiciones: "Condiciones", vincular: "Vincular", desvincular: "Desvincular", reemitir: "Reemitir"
  },
  "api/src/modulos/seguridad/http/index.ts": { altaCuenta: "AltaCuenta", esquemaConsentimiento: "Consentimiento", identidadReal: "IdentidadReal" },
  "api/src/modulos/sincronizacion/dominio/validacion.ts": { esquemaSesion: "SesionPush", esquemaLista: "ListaPush", esquemaMarca: "MarcaPush", esquemaCorreccion: "CorreccionPush", esquemaPush: "Push" },
  "api/src/modulos/actividades/dominio/validacion.ts": { esquemaActividad: "ActividadPush" },
  "api/src/modulos/actividades/http/index.ts": { esquemaAltaActividad: "AltaActividad", esquemaCambiosActividad: "CambiosActividad" },
  "api/src/modulos/ciclos/http/index.ts": { esquema: "AbrirCiclo" }
};
const iguales = (a, b) => [...a].sort().join(",") === [...b].sort().join(",");
const metadatosLocales = ["_status", "_changed"];
const filasEntradaSync = new Set(["SesionPush", "ListaPush", "MarcaPush", "CorreccionPush", "ActividadPush"]);
const camposFeedbackServidor = ["estado", "motivo_rechazo", "recibido_en"];
const schemasConFeedback = new Set(["ListaPush", "MarcaPush", "CorreccionPush"]);
const coleccionesConFeedback = ["listas_asistencia", "marcas_asistencia", "correcciones_asistencia"];
const excepcionesEntrada = schema => [
  ...(filasEntradaSync.has(schema) ? metadatosLocales : []),
  ...(schemasConFeedback.has(schema) ? camposFeedbackServidor : []),
];
for (const [archivo, declaraciones] of Object.entries(comparacionesDto)) {
  const texto = await readFile(resolve(raiz, archivo), "utf8");
  for (const [nombre, schema] of Object.entries(declaraciones)) {
    const campos = camposObjeto(texto, nombre);
    exigir(campos, `${archivo}: DTO ${nombre} no reconocido`);
    if (!campos) continue;
    const s = documento.components.schemas[schema];
    const excepciones = excepcionesEntrada(schema);
    const camposContrato = Object.keys(s.properties).filter(clave => !excepciones.includes(clave));
    exigir(iguales(campos.campos, camposContrato), `${schema}: campos de negocio divergen de ${archivo}#${nombre}`);
    exigir(iguales(campos.obligatorios, s.required ?? []), `${schema}: campos obligatorios divergen de Zod actual`);
    if (filasEntradaSync.has(schema)) for (const clave of metadatosLocales) {
      const metadato = s.properties[clave];
      exigir(metadato?.type === "string" && metadato.writeOnly === true && metadato["x-ignorado"] === true && /ignorad/i.test(metadato.description ?? "") && !(s.required ?? []).includes(clave), `${schema}.${clave}: excepción de entrada debe ser opcional, ignorada y writeOnly`);
      exigir(!campos.campos.includes(clave), `${archivo}#${nombre}: metadata local no pertenece al modelo Zod de negocio`);
    }
    if (schemasConFeedback.has(schema)) for (const clave of camposFeedbackServidor) {
      const feedback = s.properties[clave];
      exigir(feedback?.writeOnly === true && feedback["x-ignorado"] === true && /ignorad/i.test(feedback.description ?? "") && /servidor/i.test(feedback.description ?? "") && !(s.required ?? []).includes(clave), `${schema}.${clave}: feedback opcional de entrada ignorado, autoridad servidor`);
      exigir(!campos.campos.includes(clave), `${archivo}#${nombre}: feedback no pertenece al modelo Zod de negocio`);
      exigir(!feedback?.enum && feedback?.minimum === undefined, `${schema}.${clave}: no restringir al valor de salida, raw inicial puede ser vacio/cero`);
    }
    const ignoradosDocumentados = Object.entries(s.properties).filter(([, campo]) => campo["x-ignorado"] === true).map(([clave]) => clave);
    exigir(iguales(ignoradosDocumentados, excepciones), `${schema}: solo excepciones de metadata/feedback explicitas pueden estar ignoradas; autoria nunca`);
  }
}
const validacionSync = await readFile(resolve(raiz, "api/src/modulos/sincronizacion/dominio/validacion.ts"), "utf8");
exigir(/esquemaPush\s*=\s*z\.preprocess\(\s*ignorarMetadatosLocales\s*,\s*z\.object\(/.test(validacionSync), "Push debe preprocesar metadata local antes de Zod estricto");
const camposIgnorados = [...validacionSync.matchAll(/campo\s*!==\s*["']([^"']+)["']/g)].map(m => m[1]);
exigir(iguales(camposIgnorados, metadatosLocales), "Comparaciones directas del preprocesamiento deben eliminar solo _status/_changed");
const leerLiterales = lista => [...(lista ?? "").matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
const tablasFeedbackCodigo = leerLiterales(validacionSync.match(/const\s+feedback\s*=\s*\[([^\]]+)\]\.includes\(tabla\)/)?.[1]);
const camposFeedbackCodigo = leerLiterales(validacionSync.match(/feedback\s*&&\s*\[([^\]]+)\]\.includes\(campo\)/)?.[1]);
exigir(iguales(tablasFeedbackCodigo, coleccionesConFeedback), "Preprocesamiento feedback debe acotarse a exactamente listas/marcas/correcciones");
exigir(iguales(camposFeedbackCodigo, camposFeedbackServidor), "Preprocesamiento feedback debe ignorar exactamente estado/motivo_rechazo/recibido_en, nunca autores");
exigir(/!\(feedback\s*&&\s*\[([^\]]+)\]\.includes\(campo\)\)/.test(validacionSync), "Feedback se elimina solo bajo guardia de coleccion, no indiscriminadamente");
exigir(/\["created",\s*"updated"\]\.includes\(operacion\)/.test(validacionSync), "Preprocesamiento de metadatos debe limitarse a filas created/updated");
const cuerpoPush = cuerpoObjeto(validacionSync, "esquemaPush");
const mapaPush = cuerpoPush && camposObjeto(`const mapa = ${cuerpoPush.slice(cuerpoPush.indexOf(":") + 1)}`, "mapa");
exigir(mapaPush && iguales(mapaPush.campos, Object.keys(documento.components.schemas.CambiosPush.properties)), "Colecciones push deben coincidir exactamente con esquemaPush actual");
const tablaActividades = await readFile(resolve(raiz, "src/lib/actividades/tablas-sincronizadas.ts"), "utf8");
const camposPullActividad = camposObjeto(`const columnas = ${tablaActividades.slice(tablaActividades.indexOf("columnas:") + "columnas:".length)}`, "columnas");
exigir(camposPullActividad && iguales(["id", ...camposPullActividad.campos], Object.keys(documento.components.schemas.ActividadPull.properties)), "ActividadPull debe proyectar solo columnas registradas (0506), sin huella ni metadatos SQL");
const tiposActividad = await readFile(resolve(raiz, "src/lib/actividades/catalogo-actividades.ts"), "utf8");
const tiposDeclarados = tiposActividad.match(/TIPOS_ACTIVIDAD\s*=\s*\[([^\]]+)\]/)?.[1].match(/"[^"]+"/g)?.map(v => JSON.parse(v));
exigir(tiposDeclarados && iguales(tiposDeclarados, documento.components.schemas.TipoActividad.enum), "TipoActividad debe coincidir con catálogo TS");
const lapidasSql = await readFile(resolve(raiz, "api/migraciones/0309_lapidas_sincronizacion.sql"), "utf8");
const tablaLapidas = lapidasSql.match(/CREATE TABLE lapida_sincronizacion\s*\(([\s\S]*?)\n\);/)?.[1] ?? "";
const columnasLapidas = [...tablaLapidas.matchAll(/^\s*([a-z][a-z0-9_]*)\s+(?:text|uuid|timestamptz|timestamp|date|jsonb|json|bytea|integer|int|bigint|boolean|numeric|varchar)\b/gm)].map(m => m[1]);
exigir(iguales(columnasLapidas, ["tabla", "fila_id", "cuenta_id", "ciclo_id", "eliminado_en"]), "0309: ledger exige exclusivamente cinco metadatos de lápidas");
exigir(!/\b(catequizando_id|nombres|apellidos|codigo_leido|codigo_carne|detalle|contenido|salud|evidencia)\b/.test(tablaLapidas), "0309: ledger no debe guardar niño, QR, nombres ni contenido");
const retencion = await readFile(resolve(raiz, "api/src/modulos/asistencia/aplicacion/retencion.ts"), "utf8");
exigir(retencion.indexOf("await encolarLapidasRetencion") >= 0 && retencion.indexOf("await encolarLapidasRetencion") < retencion.indexOf("id=gen_random_uuid()"), "Retención debe capturar UUID original antes de mutarlo");
exigir(!Object.hasOwn(documento.paths, "/lapidas") && !Object.hasOwn(documento.components.schemas.CambiosPull.properties, "lapidas_sincronizacion"), "Ledger de lápidas no es endpoint ni colección transportada");
for (const nombre of ["Inscripcion", "Nino", "ApoderadoNuevo", "VinculoNuevo", "VinculoExistente", "Push", "CambiosPush", "SesionPush", "ListaPush", "MarcaPush", "CorreccionPush", "ActividadPush", "ActividadPull", "AltaActividad", "CambiosActividad", "AbrirCiclo"]) exigir(documento.components.schemas[nombre]?.additionalProperties === false, `DTO debe rechazar campos desconocidos: ${nombre}`);
for (const ruta of ["/ciclos/{id}/cerrar", "/ciclos/{id}/cierre"]) exigir(!documento.paths[ruta]?.post.requestBody, `${ruta}: cierre actual no acepta JSON ni {}`);
exigir(documento.paths["/ciclos/{id}/cerrar"].post.responses[200].$ref === documento.paths["/ciclos/{id}/cierre"].post.responses[200].$ref, "Alias /cerrar y /cierre deben compartir respuesta");
for (const schema of ["SesionPush", "ActividadPush"]) for (const campo of ["motivo_rechazo", "recibido_en"]) exigir(!Object.hasOwn(documento.components.schemas[schema].properties, campo), `${schema}: feedback no permitido fuera de las tres colecciones autorizadas`);
exigir(documento.components.schemas.ActividadPush.properties.estado["x-ignorado"] !== true, "Estado de actividad es dato de negocio validado, no feedback ignorado");
for (const schema of ["ListaPull", "MarcaPull", "CorreccionPull"]) for (const campo of camposFeedbackServidor) {
  const propiedad = documento.components.schemas[schema].properties[campo];
  exigir(propiedad && propiedad.writeOnly !== true && propiedad["x-ignorado"] !== true && documento.components.schemas[schema].required.includes(campo), `${schema}.${campo}: preservar feedback normal en salida canonica`);
}
const cuerpoCorreccion = cuerpoObjeto(validacionSync, "esquemaCorreccion");
const enumAnterior = cuerpoCorreccion?.match(/valor_anterior:\s*(?:z\.enum\(\[([^\]]+)\]\)|(\w+))/);
const valoresAnteriorCodigo = leerLiterales(enumAnterior?.[1] ?? (enumAnterior?.[2] ? validacionSync.match(new RegExp(`\\b${enumAnterior[2]}\\s*=\\s*z\\.enum\\(\\[([^\\]]+)\\]\\)`))?.[1] : undefined));
exigir(valoresAnteriorCodigo.length && iguales(valoresAnteriorCodigo, documento.components.schemas.CorreccionPush.properties.valor_anterior.enum), "valor_anterior de CorreccionPush debe coincidir con enum Zod actual (incluido sin_registro solo si el codigo lo admite)");
const anterioresEsperados = ["presente", "ausente", "sin_registro"];
const nuevosEsperados = ["presente", "ausente"];
const sql0310 = await readFile(resolve(raiz, "api/migraciones/0310_correcciones_sin_registro.sql"), "utf8");
const anterioresSql = leerLiterales(sql0310.match(/CHECK\s*\(valor_anterior\s+IN\s*\(([^)]+)\)/)?.[1]);
exigir(iguales(anterioresSql, anterioresEsperados) && !/ADD\s+COLUMN/i.test(sql0310), "0310 debe ampliar solo CHECK valor_anterior a tres estados, sin nuevas columnas");
const enumNuevo = cuerpoCorreccion?.match(/valor_nuevo:\s*(?:z\.enum\(\[([^\]]+)\]\)|(\w+))/);
const valoresNuevoCodigo = leerLiterales(enumNuevo?.[1] ?? (enumNuevo?.[2] ? validacionSync.match(new RegExp(`\\b${enumNuevo[2]}\\s*=\\s*z\\.enum\\(\\[([^\\]]+)\\]\\)`))?.[1] : undefined));
exigir(iguales(valoresAnteriorCodigo, anterioresEsperados) && iguales(valoresNuevoCodigo, nuevosEsperados), "Zod: anterior admite sin_registro; nuevo solo presente/ausente");
for (const schema of ["CorreccionPush", "CorreccionPull"]) {
  const propiedades = documento.components.schemas[schema].properties;
  exigir(iguales(propiedades.valor_anterior.enum, anterioresEsperados) && iguales(propiedades.valor_anterior.enum, anterioresSql), `${schema}.valor_anterior: alinear entrada/salida con SQL0310 y tres estados reales`);
  exigir(iguales(propiedades.valor_nuevo.enum, nuevosEsperados), `${schema}.valor_nuevo: sin_registro nunca es valor nuevo`);
}
exigir(documento.components.schemas.Push.required.includes("changes") && documento.components.schemas.RespuestaPull.required.includes("timestamp"), "Transporte sync debe conservar claves nativas");
exigir(documento.components.schemas.CodigoCarne.pattern.startsWith("^SGC1:"), "QR debe ser exclusivamente SGC1");
const ejemplosPush = documento.components.requestBodies.Push.content["application/json"].examples;
const original = ejemplosPush?.nativoConMetadatos?.value;
const reenvio = ejemplosPush?.reenvioConMetadatosDistintos?.value;
exigir(original && reenvio, "Faltan ejemplos nativos de metadata y reenvío");
if (original && reenvio) {
  const fila = original.changes.marcas_asistencia.created[0];
  const filaReenvio = reenvio.changes.marcas_asistencia.created[0];
  const ignoradosMarca = excepcionesEntrada("MarcaPush");
  const negocio = f => Object.fromEntries(Object.entries(f).filter(([clave]) => !ignoradosMarca.includes(clave)));
  exigir(ignoradosMarca.every(clave => Object.hasOwn(fila, clave) && JSON.stringify(fila[clave]) !== JSON.stringify(filaReenvio[clave])), "Ejemplos deben variar metadata y los tres campos de feedback");
  exigir(JSON.stringify(negocio(fila)) === JSON.stringify(negocio(filaReenvio)), "Reenvio debe conservar UUID/autoria/datos de negocio; solo varia metadata/feedback ignorado");
  exigir(fila.estado === "" && fila.recibido_en === 0 && fila.motivo_rechazo === null && filaReenvio.estado === "aceptada", "Ejemplos deben mostrar valores iniciales raw y estado aceptada enviado sin autoridad");
  exigir(validarValor({ ...fila, campoNoPermitido: true }, documento.components.schemas.MarcaPush, "pruebaDesconocido").length > 0, "Schema de entrada debe seguir rechazando otros campos desconocidos");
}
function revisarSalidaSinMetadatos(origen, ruta, visitados = new Set()) {
  if (!origen || typeof origen !== "object") return;
  if (origen.$ref) {
    if (visitados.has(origen.$ref)) return;
    const siguientes = new Set([...visitados, origen.$ref]);
    revisarSalidaSinMetadatos(referencia(origen.$ref), ruta, siguientes);
    return;
  }
  for (const clave of metadatosLocales) exigir(!Object.hasOwn(origen.properties ?? {}, clave), `${ruta}: DTO canónico de salida no debe exponer ${clave}`);
  for (const [clave, schema] of Object.entries(origen.properties ?? {})) revisarSalidaSinMetadatos(schema, `${ruta}/${clave}`, visitados);
  if (origen.items) revisarSalidaSinMetadatos(origen.items, `${ruta}/items`, visitados);
  for (const combinador of ["oneOf", "anyOf", "allOf"]) origen[combinador]?.forEach(s => revisarSalidaSinMetadatos(s, ruta, visitados));
}
for (const [ruta, item] of Object.entries(documento.paths)) for (const metodo of metodos) {
  for (const [estado, salida] of Object.entries(item[metodo]?.responses ?? {})) for (const media of Object.values(expandir(salida).content ?? {})) revisarSalidaSinMetadatos(media.schema, `${metodo} ${ruta}/${estado}`);
}
const migracionesSql = (await readdir(resolve(raiz, "api/migraciones"))).filter(nombre => /^\d{4}_[a-z0-9_]+\.sql$/.test(nombre));
if (errores.length) { console.error(`OpenAPI inválido (${errores.length}):\n${errores.join("\n")}`); process.exitCode = 1; }
else console.log(`OpenAPI 3.1 verificado: ${operaciones.size} operaciones, ${Object.keys(documento.components.schemas).length} schemas, ${migracionesSql.length} migraciones SQL inventariadas; anterior entrada/salida con sin_registro, nuevo solo presente/ausente, metadata excluida de salidas y feedback preservado.`);
