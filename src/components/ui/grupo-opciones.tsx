import { alturaBoton, colores, espacio, radio, tipografia } from '@/tema';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface OpcionGrupo {
  valor: string;
  etiqueta: string;
}

export interface PropiedadesGrupoOpciones {
  opciones: readonly OpcionGrupo[];
  valor: string | null;
  alCambiar: (valor: string) => void;
  etiqueta?: string;
}

/** Elección de una opción con un toque (sexo, bautizado, relación con el niño). */
export function GrupoOpciones({ opciones, valor, alCambiar, etiqueta }: PropiedadesGrupoOpciones) {
  return (
    <View style={estilos.contenedor}>
      {etiqueta ? (
        <Text style={[tipografia.etiqueta, { color: colores.textoSuave }]}>{etiqueta}</Text>
      ) : null}
      <View accessibilityRole="radiogroup" style={estilos.opciones}>
        {opciones.map((opcion) => {
          const elegida = opcion.valor === valor;
          return (
            <Pressable
              key={opcion.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: elegida }}
              onPress={() => alCambiar(opcion.valor)}
              style={[estilos.opcion, elegida ? estilos.elegida : null]}
            >
              <Text
                style={[
                  tipografia.cuerpoFuerte,
                  { color: elegida ? colores.primarioTexto : colores.texto },
                ]}
              >
                {opcion.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m },
  opcion: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: alturaBoton,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.campo,
    paddingHorizontal: espacio.l,
  },
  elegida: { backgroundColor: colores.primario, borderColor: colores.primario },
});
