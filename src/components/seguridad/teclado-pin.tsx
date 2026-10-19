import { alturaMinimaToque, colores, espacio, radio, tipografia } from "@/tema";
import { Pressable, StyleSheet, Text, View } from "react-native";

export const MAXIMO_DIGITOS_PIN = 6;

export type PropiedadesTecladoPin = {
  valor: string;
  alCambiar: (valor: string) => void;
  deshabilitado?: boolean;
};

/** Puntos que muestran cuantos digitos lleva el PIN y cuales faltan. */
export function PuntosPin({ valor, longitud = MAXIMO_DIGITOS_PIN }: { valor: string; longitud?: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${valor.length} de ${longitud} dígitos`}
      style={estilos.puntos}
    >
      {Array.from({ length: longitud }, (_, indice) => (
        <View
          key={indice}
          style={[estilos.punto, indice < valor.length ? estilos.puntoLleno : null]}
        />
      ))}
    </View>
  );
}

/** Teclado numerico de 0 a 9 con borrar, como el del sistema de la ilustracion. */
export function TecladoPin({ valor, alCambiar, deshabilitado = false }: PropiedadesTecladoPin) {
  const agregar = (digito: string) => {
    if (deshabilitado || valor.length >= MAXIMO_DIGITOS_PIN) return;
    alCambiar(valor + digito);
  };

  const borrar = () => {
    if (deshabilitado || !valor) return;
    alCambiar(valor.slice(0, -1));
  };

  return (
    <View style={estilos.teclado}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digito) => (
        <Tecla key={digito} etiqueta={digito} alPresionar={() => agregar(digito)} deshabilitado={deshabilitado} />
      ))}
      <Tecla etiqueta="0" alPresionar={() => agregar("0")} deshabilitado={deshabilitado} />
      <Tecla etiqueta="⌫" alPresionar={borrar} deshabilitado={deshabilitado || !valor} accessibilityLabel="Borrar" />
    </View>
  );
}

function Tecla({
  etiqueta,
  alPresionar,
  deshabilitado,
  accessibilityLabel,
}: {
  etiqueta: string;
  alPresionar: () => void;
  deshabilitado: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.tecla,
        deshabilitado ? estilos.teclaDeshabilitada : null,
        pressed && !deshabilitado ? estilos.teclaPresionada : null,
      ]}
    >
      <Text style={[tipografia.encabezado, estilos.textoTecla]}>{etiqueta}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  puntos: { flexDirection: "row", gap: espacio.m, alignItems: "center" },
  punto: {
    width: 16,
    height: 16,
    borderRadius: radio.insignia,
    borderWidth: 2,
    borderColor: colores.borde,
    backgroundColor: "transparent",
  },
  puntoLleno: { backgroundColor: colores.primario, borderColor: colores.primario },
  teclado: { flexDirection: "row", flexWrap: "wrap", gap: espacio.m, justifyContent: "center" },
  tecla: {
    width: "30%",
    minHeight: alturaMinimaToque + 8,
    borderRadius: radio.campo,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  teclaDeshabilitada: { backgroundColor: colores.neutroFondo },
  teclaPresionada: { opacity: 0.7 },
  textoTecla: { color: colores.texto },
});
