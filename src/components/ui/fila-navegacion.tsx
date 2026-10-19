import { alturaMinimaToque, colores, espacio, radio, tipografia } from '@/tema';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface PropiedadesFilaNavegacion {
  titulo: string;
  alPresionar?: () => void;
  subtitulo?: string;
  /** Insignia, contador u otro elemento a la derecha, antes del chevron. */
  derecha?: ReactNode;
  /** Opción que solo existe con conexión: se dibuja punteada y no responde al toque. */
  bloqueada?: boolean;
}

export function FilaNavegacion({
  titulo,
  alPresionar,
  subtitulo,
  derecha,
  bloqueada = false,
}: PropiedadesFilaNavegacion) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: bloqueada }}
      disabled={bloqueada || !alPresionar}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.base,
        bloqueada ? estilos.bloqueada : null,
        pressed && !bloqueada ? estilos.presionada : null,
      ]}
    >
      <View style={estilos.textos}>
        <Text style={[tipografia.cuerpoFuerte, { color: bloqueada ? colores.textoTenue : colores.texto }]}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={[tipografia.nota, { color: colores.textoSuave }]}>{subtitulo}</Text>
        ) : null}
      </View>
      {derecha ?? null}
      {bloqueada ? null : <Text style={[tipografia.encabezado, estilos.chevron]}>›</Text>}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: alturaMinimaToque + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.tarjeta,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
  },
  bloqueada: { backgroundColor: colores.fondo, borderStyle: 'dashed' },
  presionada: { opacity: 0.85 },
  textos: { flex: 1 },
  chevron: { color: colores.textoTenue },
});
