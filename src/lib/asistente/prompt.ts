import type { Fragmento, Pregunta } from "./tipos";

export function construirPrompt(pregunta: Pregunta, fragmentos: Fragmento[]): string {
  const material = fragmentos
    .map((fragmento) => `[${fragmento.documento}, ${fragmento.seccion}] ${fragmento.texto}`)
    .join("\n");

  return [
    "Responde en español, con tono respetuoso y sin presentarte como autoridad doctrinal.",
    "Responde en dos a cuatro frases claras; no copies párrafos completos si puedes explicarlos mejor.",
    "Usa únicamente los fragmentos siguientes y cita cada afirmación con el formato exacto [documento, sección].",
    "No inventes citas, referencias ni conocimiento que no aparezca en los fragmentos.",
    "Si los fragmentos no alcanzan para responder, dilo con claridad y no completes con suposiciones.",
    `Pregunta: ${pregunta.original}`,
    "Fragmentos:",
    material,
  ].join("\n");
}
