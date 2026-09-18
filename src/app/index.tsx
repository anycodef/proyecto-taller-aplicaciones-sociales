import { StyleSheet, Text, View } from "react-native";

export default function Inicio() {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.sobretitulo}>Parroquia</Text>
      <Text style={estilos.titulo}>Gestión de catequesis</Text>
      <Text style={estilos.detalle}>
        Asistencia, justificaciones y seguimiento del ciclo, en el celular que
        ya usa el equipo.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, padding: 24, gap: 8, justifyContent: "center" },
  sobretitulo: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#1e3a8a",
  },
  titulo: { fontSize: 24, fontWeight: "600" },
  detalle: { fontSize: 14, color: "#4b5563" },
});
