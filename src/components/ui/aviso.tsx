import { colores, espacio, radio, tipografia } from '@/tema';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type TonoAviso = 'informativo' | 'advertencia' | 'error';

export interface PropiedadesAviso {
  mensaje: string;
  tono?: TonoAviso;
  icono?: ReactNode;
}

const fondo: Record<TonoAviso, string> = {
  informativo: colores.primarioSuave,
  advertencia: colores.advertenciaFondo,
  error: colores.errorFondo,
};

const texto: Record<TonoAviso, string> = {
  informativo: colores.primario,
  advertencia: colores.advertenciaTexto,
  error: colores.errorTexto,
};

export function Aviso({ mensaje, tono = 'informativo', icono }: PropiedadesAviso) {
  return (
    <View
      accessibilityRole={tono === 'informativo' ? undefined : 'alert'}
      style={[estilos.base, { backgroundColor: fondo[tono] }]}
    >
      {icono ?? null}
      <Text style={[tipografia.cuerpo, estilos.texto, { color: texto[tono] }]}>{mensaje}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    borderRadius: radio.campo,
    padding: espacio.l,
  },
  texto: { flex: 1 },
});
