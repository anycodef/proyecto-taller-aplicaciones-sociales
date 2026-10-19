import { alturaBoton, colores, espacio, radio, tipografia } from '@/tema';
import type { KeyboardTypeOptions } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export interface PropiedadesCampoTexto {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  marcador?: string;
  error?: string;
  teclado?: KeyboardTypeOptions;
  maximoCaracteres?: number;
}

export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  marcador,
  error,
  teclado,
  maximoCaracteres,
}: PropiedadesCampoTexto) {
  return (
    <View style={estilos.contenedor}>
      <Text style={[tipografia.etiqueta, { color: colores.textoSuave }]}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={alCambiar}
        placeholder={marcador}
        placeholderTextColor={colores.textoTenue}
        keyboardType={teclado}
        maxLength={maximoCaracteres}
        style={[tipografia.cuerpo, estilos.campo, error ? estilos.campoConError : null]}
      />
      {error ? <Text style={[tipografia.nota, { color: colores.errorTexto }]}>{error}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  campo: {
    minHeight: alturaBoton,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.campo,
    paddingHorizontal: espacio.l,
    color: colores.texto,
  },
  campoConError: { borderColor: colores.errorTexto },
});
