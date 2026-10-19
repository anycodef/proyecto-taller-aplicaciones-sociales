import { alturaBoton, alturaMinimaToque, colores, espacio, radio, tipografia } from '@/tema';
import type { ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

export type VarianteBoton = 'primario' | 'secundario' | 'enlace';

export interface PropiedadesBoton {
  etiqueta: string;
  alPresionar: () => void;
  variante?: VarianteBoton;
  deshabilitado?: boolean;
  cargando?: boolean;
}

function colorDeTexto(variante: VarianteBoton, deshabilitado: boolean): string {
  if (deshabilitado) return colores.deshabilitadoTexto;
  return variante === 'primario' ? colores.primarioTexto : colores.primario;
}

function estiloDeContenedor(variante: VarianteBoton, deshabilitado: boolean): ViewStyle {
  if (variante === 'enlace') return estilos.enlace;
  if (deshabilitado) return estilos.deshabilitado;
  return variante === 'primario' ? estilos.primario : estilos.secundario;
}

export function Boton({
  etiqueta,
  alPresionar,
  variante = 'primario',
  deshabilitado = false,
  cargando = false,
}: PropiedadesBoton) {
  const inactivo = deshabilitado || cargando;
  const color = colorDeTexto(variante, deshabilitado);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.base,
        estiloDeContenedor(variante, deshabilitado),
        pressed && !inactivo ? estilos.presionado : null,
      ]}
    >
      {cargando ? <ActivityIndicator color={color} /> : null}
      <Text style={[tipografia.boton, { color }, variante === 'enlace' ? estilos.subrayado : null]}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: alturaBoton,
    borderRadius: radio.boton,
    paddingHorizontal: espacio.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
  },
  primario: { backgroundColor: colores.primario },
  secundario: {
    backgroundColor: colores.superficie,
    borderWidth: 2,
    borderColor: colores.primario,
  },
  deshabilitado: { backgroundColor: colores.deshabilitado },
  enlace: { minHeight: alturaMinimaToque, backgroundColor: 'transparent' },
  presionado: { opacity: 0.85 },
  subrayado: { textDecorationLine: 'underline' },
});
