import { StyleSheet, Text, View } from "react-native";

/**
 * Marca una pantalla que ya tiene ruta y contrato de datos definidos, pero
 * cuya implementacion llega en la fase de prototipado.
 */
export function Pendiente({ items }: { items: string[] }) {
  return (
    <View style={estilos.caja}>
      <Text style={estilos.etiqueta}>Pendiente de prototipado</Text>
      {items.map((item) => (
        <Text key={item} style={estilos.item}>
          {"\u2022"} {item}
        </Text>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  etiqueta: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6b7280",
    marginBottom: 4,
  },
  item: { fontSize: 14, color: "#4b5563" },
});
