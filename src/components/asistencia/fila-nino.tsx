import { StyleSheet, Text, View } from "react-native";

import { colores, espacio, radio, tipografia } from "@/tema";

export type PropsFilaNino = {
  nombres: string;
  apellidos: string;
  valor: "presente" | "ausente";
  onAlternar: () => void;
};

export function FilaNino({ nombres, apellidos, valor, onAlternar }: PropsFilaNino) {
  return (
    <View style={estilos.fila}>
      <View style={estilos.textos}>
        <Text style={[tipografia.cuerpoFuerte, estilos.nombre]}>
          {nombres} {apellidos}
        </Text>
      </View>
      <Text
        accessibilityRole="button"
        accessibilityLabel={`${nombres} ${apellidos}, ${
          valor === "presente" ? "presente" : "ausente"
        }. Toca para cambiar`}
        onPress={onAlternar}
        style={[
          estilos.valor,
          valor === "presente" ? estilos.presente : estilos.ausente,
        ]}
      >
        {valor === "presente" ? "Presente" : "Ausente"}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.tarjeta,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    minHeight: 56,
  },
  textos: { flex: 1 },
  nombre: { color: colores.texto },
  valor: {
    borderRadius: radio.insignia,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "600",
  },
  presente: { backgroundColor: colores.primarioSuave, color: colores.primario },
  ausente: { backgroundColor: colores.errorFondo, color: colores.errorTexto },
});
