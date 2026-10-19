import { colores, espacio, radio, tipografia } from '@/tema';
import { StyleSheet, Text, View } from 'react-native';

export type TonoInsignia = 'solido' | 'suave' | 'advertencia' | 'error' | 'neutro';

export interface PropiedadesInsignia {
  texto: string;
  tono?: TonoInsignia;
}

const fondo: Record<TonoInsignia, string> = {
  solido: colores.primario,
  suave: colores.primarioSuave,
  advertencia: colores.advertenciaFondo,
  error: colores.errorFondo,
  neutro: colores.neutroFondo,
};

const texto: Record<TonoInsignia, string> = {
  solido: colores.primarioTexto,
  suave: colores.primario,
  advertencia: colores.advertenciaTexto,
  error: colores.errorTexto,
  neutro: colores.neutroTexto,
};

export function Insignia({ texto: contenido, tono = 'suave' }: PropiedadesInsignia) {
  return (
    <View style={[estilos.base, { backgroundColor: fondo[tono] }]}>
      <Text style={[tipografia.insignia, { color: texto[tono] }]}>{contenido}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radio.insignia,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs + 2,
  },
});
