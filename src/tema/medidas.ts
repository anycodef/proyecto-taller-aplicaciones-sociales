import type { TextStyle } from 'react-native';
export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radio = { insignia: 999, campo: 14, boton: 18, tarjeta: 20 } as const;

export const alturaMinimaToque = 48;
export const alturaBoton = 56;

export const tipografia = {
    titulo: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
    encabezado: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
    cuerpo: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    cuerpoFuerte: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
    etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
    nota: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
    boton: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
    insignia: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} satisfies Record<string, TextStyle>;