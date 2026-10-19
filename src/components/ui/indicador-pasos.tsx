import { colores, espacio, radio, tipografia } from '@/tema';
import { StyleSheet, Text, View } from 'react-native';

export interface PropiedadesIndicadorPasos {
  actual: number;
  total: number;
}

export function IndicadorPasos({ actual, total }: PropiedadesIndicadorPasos) {
  return (
    <View
      accessible
      accessibilityLabel={`Paso ${actual} de ${total}`}
      style={estilos.contenedor}
    >
      <Text style={[tipografia.etiqueta, estilos.texto]}>{`Paso ${actual} de ${total}`}</Text>
      <View style={estilos.barras}>
        {Array.from({ length: total }, (_, indice) => (
          <View
            key={indice}
            style={[estilos.barra, indice < actual ? estilos.barraCompleta : null]}
          />
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  texto: { color: colores.primario, textTransform: 'uppercase' },
  barras: { flexDirection: 'row', gap: espacio.s },
  barra: { flex: 1, height: 6, borderRadius: radio.insignia, backgroundColor: colores.neutroFondo },
  barraCompleta: { backgroundColor: colores.primario },
});
