import { z } from "zod";

export function configuracionBaseDatos(): { url: string } {
  const resultado = z.string().url().refine(url => ["postgres:", "postgresql:"].includes(new URL(url).protocol)).safeParse(process.env.BD_URL);
  if (!resultado.success) throw new Error("BD_URL debe ser una URL PostgreSQL válida");
  return { url: resultado.data };
}
