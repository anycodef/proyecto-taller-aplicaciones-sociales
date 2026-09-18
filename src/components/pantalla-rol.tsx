import { ScrollView, StyleSheet, Text } from "react-native";

import { Pendiente } from "./pendiente";

type Props = {
  rol: string;
  titulo: string;
  descripcion: string;
  pendientes: string[];
};

/** Estructura comun de las pantallas de entrada de cada rol. */
export function PantallaRol({ rol, titulo, descripcion, pendientes }: Props) {
  return (
    <ScrollView contentContainerStyle={estilos.contenedor}>
      <Text style={estilos.rol}>{rol}</Text>
      <Text style={estilos.titulo}>{titulo}</Text>
      <Text style={estilos.descripcion}>{descripcion}</Text>
      <Pendiente items={pendientes} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 24, gap: 8 },
  rol: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#1e3a8a",
  },
  titulo: { fontSize: 24, fontWeight: "600" },
  descripcion: { fontSize: 14, color: "#4b5563", marginBottom: 16 },
});
