export const inscripcionTieneConsentimiento = (consentimientos: { retiradoEn?: string | null }[]): boolean => consentimientos.some(c => !c.retiradoEn);
export const efectoRetiro = () => ({ borrar: ["restringido", "documentos", "historial-personal", "apoderado-sin-otros-hijos", "evidencias", "avance"], conservar: ["asistencia-anonimizada", "constancia"] });
export const textoCumpleRequisitos = (texto: string): boolean => /constancia sacramental/i.test(texto) && /sin vencimiento/i.test(texto);
