import type { Fragmento, Pregunta } from "./tipos";

export function construirPrompt(pregunta: Pregunta, fragmentos: Fragmento[]): string {
  const material = fragmentos
    .map((fragmento) => `[${fragmento.documento}, ${fragmento.seccion}] ${fragmento.texto}`)
    .join("\n");

  return [
    "Responde en español, con tono respetuoso y sin presentarte como autoridad doctrinal.",
    "Usa únicamente los fragmentos siguientes y cita cada afirmación con [documento, sección].",
    `Pregunta: ${pregunta.original}`,
    "Fragmentos:",
    material,
  ].join("\n");
}
