// Medición reproducible de la carga útil de la misma pregunta por tres caminos.
// No levanta servicios: serializa los contratos congelados con datos ficticios.
// Sirve como cota honesta y sustituible por la medición e2e de P4/P5.
import { Buffer } from "node:buffer";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..", "..", "..");

const grupoId = "11111111-1111-4111-8111-111111111111";
const fecha = "2026-10-18T15:04:05.000Z";
const motivo = {
  BAJO: "0-1 faltas consecutivas sin justificar",
  MEDIO: "2 faltas consecutivas sin justificar",
  ALTO: "3 o mas faltas consecutivas sin justificar",
};

const catequizandos = Array.from({ length: 12 }, (_, indice) => ({
  id: `22222222-2222-4222-8222-${String(indice + 1).padStart(12, "0")}`,
  identidadOperativa: `Catequizando ${String(indice + 1).padStart(2, "0")}`,
}));

const enRiesgo = [
  { catequizandoId: catequizandos[2].id, identidadOperativa: catequizandos[2].identidadOperativa, nivel: "MEDIO" },
  { catequizandoId: catequizandos[4].id, identidadOperativa: catequizandos[4].identidadOperativa, nivel: "ALTO" },
  { catequizandoId: catequizandos[7].id, identidadOperativa: catequizandos[7].identidadOperativa, nivel: "MEDIO" },
  { catequizandoId: catequizandos[10].id, identidadOperativa: catequizandos[10].identidadOperativa, nivel: "ALTO" },
].map((caso) => ({ ...caso, motivo: motivo[caso.nivel], calculadoEn: fecha }));

const bytes = (valor) => Buffer.byteLength(typeof valor === "string" ? valor : JSON.stringify(valor), "utf8");
const tokens = (cantidad) => Math.ceil(cantidad / 4);
const fmt = (cantidad) => new Intl.NumberFormat("es-PE").format(cantidad);

function varint(numero) {
  const salida = [];
  let resto = numero;
  while (resto > 127) {
    salida.push((resto & 127) | 128);
    resto >>>= 7;
  }
  salida.push(resto);
  return Buffer.from(salida);
}

const etiqueta = (campo, tipo) => varint((campo << 3) | tipo);

function cadena(campo, texto) {
  const dato = Buffer.from(texto, "utf8");
  return Buffer.concat([etiqueta(campo, 2), varint(dato.length), dato]);
}

function enumerado(campo, valor) {
  return Buffer.concat([etiqueta(campo, 0), varint(valor)]);
}

const niveles = { BAJO: 1, MEDIO: 2, ALTO: 3 };

function codificarRiesgo(riesgo) {
  return Buffer.concat([
    cadena(1, riesgo.catequizandoId),
    enumerado(2, niveles[riesgo.nivel]),
    cadena(3, riesgo.motivo),
    cadena(4, riesgo.calculadoEn),
  ]);
}

function codificarSolicitudRecalculo(catequizandoId) {
  return cadena(1, catequizandoId);
}

function marcoGrpc(carga) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(carga.length, 0);
  return Buffer.concat([Buffer.from([0]), largo, carga]);
}

// 1) GraphQL: una sola consulta que trae la nomina y su riesgo.
const consultaNomina = `query RiesgoDelGrupo($grupoId: ID!) {
  catequizandos(grupoId: $grupoId, primero: 50) {
    nodos { id identidadOperativa riesgo { nivel motivo } }
  }
}`;
const solicitudNomina = JSON.stringify({
  operationName: "RiesgoDelGrupo",
  query: consultaNomina,
  variables: { grupoId },
});
const respuestaNomina = {
  data: {
    catequizandos: {
      nodos: catequizandos.map((nino) => {
        const riesgo = enRiesgo.find((caso) => caso.catequizandoId === nino.id);
        return {
          id: nino.id,
          identidadOperativa: nino.identidadOperativa,
          riesgo: {
            nivel: riesgo?.nivel ?? "BAJO",
            motivo: riesgo?.motivo ?? motivo.BAJO,
          },
        };
      }),
    },
  },
};

// 2) GraphQL en dos llamadas: riesgo primero y nombres despues (composición manual).
const consultaRiesgo = `query RiesgoDelGrupo($grupoId: ID!, $nivel: NivelRiesgo) {
  riesgoDelGrupo(grupoId: $grupoId, nivelMinimo: $nivel) {
    catequizandoId nivel motivo
  }
}`;
const solicitudRiesgo = JSON.stringify({
  operationName: "RiesgoDelGrupo",
  query: consultaRiesgo,
  variables: { grupoId, nivel: "MEDIO" },
});
const respuestaRiesgo = {
  data: {
    riesgoDelGrupo: enRiesgo.map(({ catequizandoId, nivel, motivo: razon }) => ({
      catequizandoId,
      nivel,
      motivo: razon,
    })),
  },
};

const consultaNombres = `query Nombres($a: ID!, $b: ID!, $c: ID!, $d: ID!) {
  a: catequizando(id: $a) { identidadOperativa }
  b: catequizando(id: $b) { identidadOperativa }
  c: catequizando(id: $c) { identidadOperativa }
  d: catequizando(id: $d) { identidadOperativa }
}`;
const solicitudNombres = JSON.stringify({
  operationName: "Nombres",
  query: consultaNombres,
  variables: {
    a: enRiesgo[0].catequizandoId,
    b: enRiesgo[1].catequizandoId,
    c: enRiesgo[2].catequizandoId,
    d: enRiesgo[3].catequizandoId,
  },
});
const respuestaNombres = {
  data: Object.fromEntries(
    enRiesgo.map((caso, indice) => [
      ["a", "b", "c", "d"][indice],
      { identidadOperativa: caso.identidadOperativa },
    ]),
  ),
};

// 3) GraphQL ingenuo: una llamada de nombre por cada nino en riesgo.
const consultaUnNombre = `query Nombre($id: ID!) {
  catequizando(id: $id) { identidadOperativa }
}`;
const solicitudUnNombre = JSON.stringify({
  operationName: "Nombre",
  query: consultaUnNombre,
  variables: { id: enRiesgo[0].catequizandoId },
});
const respuestaUnNombre = {
  data: { catequizando: { identidadOperativa: enRiesgo[0].identidadOperativa } },
};

// 4) gRPC con el contrato congelado: no hay RPC de lectura por grupo.
// Para responder habria que invocar RecalcularRiesgo (escritura) una vez por nino.
const solicitudesGrpc = catequizandos.map((nino) => marcoGrpc(codificarSolicitudRecalculo(nino.id)));
const respuestasGrpc = catequizandos.map((nino) => {
  const riesgo = enRiesgo.find((caso) => caso.catequizandoId === nino.id);
  return marcoGrpc(
    codificarRiesgo({
      catequizandoId: nino.id,
      nivel: riesgo?.nivel ?? "BAJO",
      motivo: riesgo?.motivo ?? motivo.BAJO,
      calculadoEn: fecha,
    }),
  );
});
const bytesSolicitudGrpc = solicitudesGrpc.reduce((total, carga) => total + carga.length, 0);
const bytesRespuestaGrpc = respuestasGrpc.reduce((total, carga) => total + carga.length, 0);

// 5) MCP: una herramienta compuesta. El servidor hace las consultas internas y
// devuelve al agente solo el JSON corto que necesita para responder.
const solicitudMcp = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "listar_riesgo_grupo",
    arguments: { grupoId, nivelMinimo: "MEDIO" },
  },
});
const textoMcp = JSON.stringify(
  enRiesgo.map(({ identidadOperativa, nivel, motivo: razon }) => ({
    identidadOperativa,
    nivel,
    motivo: razon,
  })),
);
const respuestaMcp = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: textoMcp }], isError: false },
});

// 6) Descubrimiento: tamaño de los artefactos que el agente debe conocer.
const sdlGraphql = readFileSync(join(raiz, "tarea3", "contratos", "schema.graphql"), "utf8");
const protoGrpc = readFileSync(join(raiz, "tarea3", "contratos", "sigecat.proto"), "utf8");
const listaHerramientasMcp = JSON.stringify({
  jsonrpc: "2.0",
  id: 0,
  result: {
    tools: [
      {
        name: "listar_riesgo_grupo",
        description: "Lista el riesgo actual del grupo.",
        inputSchema: {
          type: "object",
          properties: {
            grupoId: { type: "string" },
            nivelMinimo: { type: "string", enum: ["BAJO", "MEDIO", "ALTO"] },
          },
          required: ["grupoId"],
        },
      },
      {
        name: "consultar_catequizando",
        description: "Consulta la ficha operativa de un catequizando.",
        inputSchema: {
          type: "object",
          properties: {
            catequizandoId: { type: "string" },
            incluirAsistencias: { type: "boolean" },
          },
          required: ["catequizandoId"],
        },
      },
      {
        name: "resumen_asistencia_domingo",
        description: "Resume la asistencia de un domingo.",
        inputSchema: {
          type: "object",
          properties: { grupoId: { type: "string" }, fecha: { type: "string" } },
          required: ["grupoId", "fecha"],
        },
      },
      {
        name: "registrar_asistencia",
        description: "Registra una asistencia de forma idempotente.",
        inputSchema: {
          type: "object",
          properties: {
            catequizandoId: { type: "string" },
            fecha: { type: "string" },
            estado: { type: "string", enum: ["PRESENTE", "AUSENTE", "JUSTIFICADA", "TARDANZA"] },
          },
          required: ["catequizandoId", "fecha", "estado"],
        },
      },
      {
        name: "registrar_justificacion",
        description: "Registra una justificacion idempotente.",
        inputSchema: {
          type: "object",
          properties: { asistenciaId: { type: "string" }, motivo: { type: "string" } },
          required: ["asistenciaId", "motivo"],
        },
      },
      {
        name: "recalcular_riesgo",
        description: "Recalcula el riesgo de un catequizando.",
        inputSchema: {
          type: "object",
          properties: { catequizandoId: { type: "string" } },
          required: ["catequizandoId"],
        },
      },
    ],
  },
});

const filas = [
  {
    camino: "GraphQL: una consulta a catequizandos con riesgo anidado",
    llamadas: 1,
    solicitud: bytes(solicitudNomina),
    respuesta: bytes(respuestaNomina),
    nota: "Trae 12 niños y el agente filtra; no necesita conocer IDs de antemano.",
  },
  {
    camino: "GraphQL: riesgo + nombres en 2 llamadas (composición manual)",
    llamadas: 2,
    solicitud: bytes(solicitudRiesgo) + bytes(solicitudNombres),
    respuesta: bytes(respuestaRiesgo) + bytes(respuestaNombres),
    nota: "Solo los 4 niños en riesgo; requiere que el agente componga la segunda consulta.",
  },
  {
    camino: "GraphQL: 1 riesgo + 4 nombres (ingenuo)",
    llamadas: 5,
    solicitud: bytes(solicitudRiesgo) + 4 * bytes(solicitudUnNombre),
    respuesta: bytes(respuestaRiesgo) + 4 * bytes(respuestaUnNombre),
    nota: "Ronda por cada nombre; más llamadas y más contexto.",
  },
  {
    camino: "gRPC con el contrato congelado (12 RecalcularRiesgo)",
    llamadas: 12,
    solicitud: bytesSolicitudGrpc,
    respuesta: bytesRespuestaGrpc,
    nota: "No existe RPC de lectura por grupo; se usaría una escritura por niño y además devuelve los 12.",
  },
  {
    camino: "MCP: listar_riesgo_grupo (1 herramienta compuesta)",
    llamadas: 1,
    solicitud: bytes(solicitudMcp),
    respuesta: bytes(respuestaMcp),
    nota: "El servidor hace la composición; el agente ve solo nombre, nivel y motivo de los 4 en riesgo.",
  },
];

const lineas = [
  "# Salida de la medición de respuestas",
  "",
  "Generado por `node docs/tarea-3/medicion/medir-respuestas.mjs`. Pregunta:",
  "«¿quién está en riesgo en el grupo?». Datos ficticios, contratos congelados.",
  "La carga útil de la respuesta no incluye TLS, cabeceras HTTP/2 ni metadata",
  "JWT; la lista de herramientas se mide aparte. Los tokens son una aproximación",
  "de bytes/4, no un tokenizer del modelo.",
  "",
  "## Descubrimiento de capacidades",
  "",
  `| Artefacto | Bytes | Tokens aprox. |`,
  `| --- | ---: | ---: |`,
  `| SDL GraphQL (\`schema.graphql\`) | ${fmt(bytes(sdlGraphql))} | ${fmt(tokens(bytes(sdlGraphql)))} |`,
  `| Proto gRPC (\`sigecat.proto\`) | ${fmt(bytes(protoGrpc))} | ${fmt(tokens(bytes(protoGrpc)))} |`,
  `| Lista MCP de 6 herramientas (JSON-RPC) | ${fmt(bytes(listaHerramientasMcp))} | ${fmt(tokens(bytes(listaHerramientasMcp)))} |`,
  "",
  "La introspección GraphQL completa no se mide aquí porque sería mayor que el SDL;",
  "un agente no debería pedirla entera para una pregunta. El proto se compila en el",
  "cliente y no viaja en cada respuesta. La lista MCP sí se entrega al agente al",
  "iniciar la sesión.",
  "",
  "## Respuesta a la misma pregunta",
  "",
  "| Camino | Llamadas | Bytes solicitud | Bytes respuesta | Bytes totales | Tokens aprox. (respuesta) | Nota |",
  "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...filas.map(
    (fila) =>
      `| ${fila.camino} | ${fila.llamadas} | ${fmt(fila.solicitud)} | ${fmt(fila.respuesta)} | ${fmt(fila.solicitud + fila.respuesta)} | ${fmt(tokens(fila.respuesta))} | ${fila.nota} |`,
  ),
  "",
  "## Lectura",
  "",
  "- MCP gana en la respuesta porque una herramienta compuesta devuelve solo los 4",
  "  casos relevantes y no obliga al agente a conocer el esquema ni a componer",
  "  consultas. Su costo está en la lista de herramientas y en el servidor.",
  "- GraphQL gana si el agente ya sabe consultar y quiere explorar campos; su",
  "  mejor caso son 2 llamadas, pero el ingenuo multiplica tokens.",
  "- gRPC pierde para esta pregunta: el contrato no tiene lectura de riesgo por",
  "  grupo y habría que escribir 12 veces para obtener una respuesta peor.",
  "- La medición es una cota de contratos, no una prueba e2e. P4/P5 deben",
  "  reemplazarla por los bytes reales de la demo cuando esté integrada.",
  "",
];

const salida = join(aqui, "salida-medicion.md");
writeFileSync(salida, lineas.join("\n"), "utf8");
console.log(lineas.join("\n"));
console.log(`\nGuardado en ${salida}`);
