import { z } from "zod";
import { TIPOS_ACTIVIDAD } from "@/lib/actividades/catalogo-actividades";
const uuid = z.string().uuid();
export const esquemaActividad = z.object({ id: uuid, ciclo_id: uuid, nombre: z.string().max(150), tipo: z.enum(TIPOS_ACTIVIDAD), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), estado: z.enum(["vigente", "cancelada"]), creado_por: uuid, cuenta_id: uuid, credencial_id: uuid, dispositivo_id: uuid }).strict();
export type EntradaActividad = z.infer<typeof esquemaActividad>;
