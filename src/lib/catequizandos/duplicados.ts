export const normalizarTexto = (texto: string): string => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export const claveDuplicado = (nombres: string, apellidos: string, fechaNacimiento: string): string => JSON.stringify([normalizarTexto(nombres), normalizarTexto(apellidos), fechaNacimiento]);
