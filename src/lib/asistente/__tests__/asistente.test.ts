import {
  cargarCorpus,
  construirPrompt,
  consultarAsistente,
  crearPregunta,
  evaluarGuardia,
  normalizarTexto,
  ProveedorExtractivo,
  recuperarFragmentos,
  validarRespuesta,
  type Corpus,
  type Fragmento,
  type ProveedorRespuesta,
} from "@/lib/asistente";

function fragmento(datos: Partial<Fragmento> & { id: string; texto: string }): Fragmento {
  return {
    documento: "Documento",
    seccion: datos.id,
    fuente: "https://example.org/fuente",
    licencia: "Dominio público",
    version: "v1",
    ...datos,
  };
}

function corpusDe(...fragmentos: Fragmento[]): Corpus {
  return cargarCorpus({ version: "v1", fragmentos });
}

const eucaristia = fragmento({
  id: "eucaristia",
  seccion: "Eucaristía",
  texto: "La Eucaristía es el sacramento del cuerpo y la sangre de Cristo.",
});
const bautismo = fragmento({
  id: "bautismo",
  seccion: "Bautismo",
  texto: "El Bautismo es el primer sacramento de la iniciación cristiana.",
});

test("RF-1002: la normalización compara '¿Qué es la Eucaristía?' con 'eucaristia'", () => {
  expect(normalizarTexto("¿Qué es la Eucaristía?")).toBe("que es la eucaristia");
  expect(crearPregunta("¿Qué es la Eucaristía?").terminos).toEqual(["eucaristia"]);
  expect(crearPregunta("eucaristia").terminos).toEqual(["eucaristia"]);
});

test("RF-1002: BM25 devuelve primero el fragmento correcto y descarta el irrelevante", () => {
  const resultado = recuperarFragmentos(corpusDe(eucaristia, bautismo), crearPregunta("eucaristia"));
  expect(resultado.fragmentos.map((fragmentoEncontrado) => fragmentoEncontrado.id)).toEqual(["eucaristia"]);
  expect(resultado.puntajes[0]).toBeGreaterThan(0.1);
});

test("RF-1002: BM25 mantiene orden estable en empate y acepta corpus vacío", () => {
  const primero = fragmento({ id: "oracion-a", texto: "La oración es el diálogo con Dios." });
  const segundo = fragmento({ id: "oracion-b", texto: "La oración es el diálogo con Dios." });
  const empate = recuperarFragmentos(corpusDe(primero, segundo), crearPregunta("oración"));
  expect(empate.fragmentos.map((fragmentoEncontrado) => fragmentoEncontrado.id)).toEqual(["oracion-a", "oracion-b"]);

  const vacio = cargarCorpus({ version: "v1", fragmentos: [] });
  expect(recuperarFragmentos(vacio, crearPregunta("oración"))).toEqual({ fragmentos: [], puntajes: [] });
});

test("RF-1002 RNF-1005: el cargador rechaza fragmentos incompletos y ids repetidos", () => {
  expect(() =>
    cargarCorpus({
      version: "v1",
      fragmentos: [{ id: "incompleto", documento: "Documento", seccion: "Sección", texto: "Texto", fuente: "Fuente", version: "v1" }],
    }),
  ).toThrow("no tiene licencia");

  expect(() => cargarCorpus({ version: "v1", fragmentos: [eucaristia, { ...eucaristia }] })).toThrow("repite");
});

test("RF-1003: una cita inventada invalida la respuesta y otra cita válida pasa", () => {
  expect(validarRespuesta("Respuesta [Documento, Inventada]", [eucaristia])).toEqual({
    valida: false,
    motivo: "cita_inventada",
  });
  expect(validarRespuesta("La Eucaristía es un sacramento [Documento, Eucaristía]", [eucaristia])).toEqual({
    valida: true,
  });
});

test("RF-1003: sin fragmentos sobre el umbral responde abstención sin fuentes", async () => {
  const respuesta = await consultarAsistente("¿Qué es un dinosaurio?", { corpus: corpusDe(eucaristia) });
  expect(respuesta.fuentes).toEqual([]);
  expect(respuesta.modelo).toBe("abstencion");
  expect(respuesta.respuesta).toContain("No encontré sustento");
});

test("RF-1004: rechaza datos de menores, salud, documentos, familia y riesgo", () => {
  for (const pregunta of [
    "¿Cuál es la salud de mi hijo?",
    "¿Quién está en riesgo?",
    "¿Cuál es el DNI del niño?",
    "¿Cuál es la situación familiar de Juan?",
  ]) {
    const evaluacion = evaluarGuardia(pregunta);
    expect(evaluacion.permitida).toBe(false);
    if (!evaluacion.permitida) expect(evaluacion.motivo).toBe("datos_personales");
  }
});

test("RF-1004: rechaza diagnóstico y consejo médico, legal o psicológico", () => {
  for (const pregunta of ["¿Me das un diagnóstico?", "¿Qué abogado me recomiendas para una demanda?"]) {
    const evaluacion = evaluarGuardia(pregunta);
    expect(evaluacion.permitida).toBe(false);
    if (!evaluacion.permitida) expect(evaluacion.motivo).toBe("consejo_profesional");
  }
  expect(evaluarGuardia("¿Qué es la Eucaristía?").permitida).toBe(true);
  expect(evaluarGuardia("¿Qué es el Padre Nuestro?").permitida).toBe(true);
});

test("RF-1007: una respuesta que se presenta como autoridad doctrinal se convierte en abstención", async () => {
  const proveedor: ProveedorRespuesta = {
    generar: async () => ({
      texto: "Yo, la Iglesia, te aseguro que esto es así [Documento, Eucaristía].",
      proveedor: "falso",
      modelo: "falso",
    }),
  };
  const respuesta = await consultarAsistente("¿Qué es la Eucaristía?", { corpus: corpusDe(eucaristia), proveedor });
  expect(respuesta.modelo).toBe("abstencion");
  expect(respuesta.fuentes).toEqual([]);
});

test("RNF-1001 RNF-1002: el proveedor se sustituye sin red y el fallback extractivo responde con citas", async () => {
  const proveedorQueFalla: ProveedorRespuesta = {
    generar: async () => {
      throw new Error("proveedor no disponible");
    },
  };
  const respuesta = await consultarAsistente("¿Qué es la Eucaristía?", {
    corpus: corpusDe(eucaristia),
    proveedor: proveedorQueFalla,
    proveedorRespaldo: new ProveedorExtractivo(),
  });

  expect(respuesta.proveedor).toBe("extractivo");
  expect(respuesta.respuesta).toContain("[Documento, Eucaristía]");
  expect(respuesta.fuentes).toHaveLength(1);
});

test("RNF-1004: la respuesta incluye versión del corpus y proveedor/modelo", async () => {
  const respuesta = await consultarAsistente("¿Qué es la Eucaristía?", { corpus: corpusDe(eucaristia) });
  expect(respuesta.versionCorpus).toBe("v1");
  expect(respuesta.proveedor).toBe("extractivo");
  expect(respuesta.modelo).toBe("extractivo-1");
});

test("RF-1003: el prompt contiene solo la pregunta y los fragmentos recuperados", () => {
  const prompt = construirPrompt(crearPregunta("¿Qué es la Eucaristía?"), [eucaristia]);
  expect(prompt).toContain("Pregunta: ¿Qué es la Eucaristía?");
  expect(prompt).toContain("[Documento, Eucaristía]");
  expect(prompt).not.toContain("nombre del niño");
});

test("RF-1004: rechaza preguntas por el seguimiento de una persona concreta aunque no diga «niño»", () => {
  for (const pregunta of [
    "¿Cuántas faltas tiene Juan?",
    "¿Faltó María el domingo?",
    "¿Está en riesgo el hijo de la señora Rosa?",
    "dame el teléfono de Pedro Ramírez",
    "cómo va mi hijo",
    "¿Cómo le fue a Ana en la catequesis?",
    "cuantas faltas tiene juan",
    "¿Asistió el niño ayer?",
  ]) {
    const evaluacion = evaluarGuardia(pregunta);
    expect({ pregunta, permitida: evaluacion.permitida }).toEqual({ pregunta, permitida: false });
    if (!evaluacion.permitida) expect(evaluacion.motivo).toBe("datos_personales");
  }
});

test("RF-1004: no bloquea preguntas doctrinales con nombres bíblicos ni palabras como «falta»", () => {
  for (const pregunta of [
    "¿Quién fue Juan el Bautista?",
    "¿Qué dijo Pedro en Pentecostés?",
    "¿Qué es la confirmación?",
    "¿Qué es la eucaristía?",
    "¿Qué dice la Biblia sobre la falta de fe?",
    "¿Dónde vive Dios?",
    "¿Qué hizo María en Nazaret?",
    "¿Qué enseñó Jesús sobre la salud del alma?",
  ]) {
    const evaluacion = evaluarGuardia(pregunta);
    expect({ pregunta, permitida: evaluacion.permitida }).toEqual({ pregunta, permitida: true });
  }
});

test("RF-1004: «receta de ceviche» no es consejo profesional y termina en abstención por falta de sustento", async () => {
  expect(evaluarGuardia("dame una receta de ceviche").permitida).toBe(true);
  expect(evaluarGuardia("¿Quién ganó el mundial?").permitida).toBe(true);
  const respuesta = await consultarAsistente("dame una receta de ceviche", { corpus: corpusDe(eucaristia) });
  expect(respuesta.proveedor).toBe("extractivo");
  expect(respuesta.modelo).toBe("abstencion");
  expect(respuesta.fuentes).toEqual([]);
  expect(respuesta.respuesta).toContain("No encontré sustento");
});

test("RF-1004: sigue rechazando consejo médico con receta médica, recetar, medicamentos y dosis", () => {
  for (const pregunta of [
    "me recetaron antibióticos, ¿qué dosis?",
    "¿Me puedes dar una receta médica?",
    "¿Puedes recetar algo para la fiebre?",
    "¿Qué medicamentos debo tomar?",
    "¿Cuál es el tratamiento para la ansiedad?",
  ]) {
    const evaluacion = evaluarGuardia(pregunta);
    expect({ pregunta, permitida: evaluacion.permitida }).toEqual({ pregunta, permitida: false });
    if (!evaluacion.permitida) expect(evaluacion.motivo).toBe("consejo_profesional");
  }
});

test("RF-1004: «¿Cuántas faltas tiene Juan?» responde con el filtro de datos personales y sin fuentes", async () => {
  const respuesta = await consultarAsistente("¿Cuántas faltas tiene Juan?", { corpus: corpusDe(eucaristia) });
  expect(respuesta).toMatchObject({ proveedor: "guardia", modelo: "filtro", fuentes: [] });
  expect(respuesta.respuesta).toContain("No puedo consultar datos de niños");
});
