import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const accesos: { href: Href; rol: string; titulo: string; detalle: string }[] = [
  {
    href: "/asistencia",
    rol: "Catequista",
    titulo: "Pasar lista",
    detalle: "Funciona sin senal. Se envia solo cuando vuelve la conexion.",
  },
  {
    href: "/coordinacion",
    rol: "Coordinacion",
    titulo: "Panel del ciclo",
    detalle: "Asistencia por grupo, justificaciones y senales de riesgo.",
  },
  {
    href: "/familia",
    rol: "Familia",
    titulo: "Mi hijo o hija",
    detalle: "Asistencias del ciclo y envio de justificaciones.",
  },
];

export default function Inicio() {
  return (
    <ScrollView contentContainerStyle={estilos.contenedor}>
      <Text style={estilos.sobretitulo}>Parroquia</Text>
      <Text style={estilos.titulo}>Gestion de catequesis</Text>
      <Text style={estilos.detalle}>
        Asistencia, justificaciones y seguimiento del ciclo, en el celular que
        ya usa el equipo.
      </Text>

      <View style={estilos.lista}>
        {accesos.map((acceso) => (
          <Link key={acceso.rol} href={acceso.href} asChild>
            <Pressable
              style={({ pressed }) => [estilos.tarjeta, pressed && estilos.tarjetaPresionada]}
            >
              <Text style={estilos.tarjetaRol}>{acceso.rol}</Text>
              <Text style={estilos.tarjetaTitulo}>{acceso.titulo}</Text>
              <Text style={estilos.tarjetaDetalle}>{acceso.detalle}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 24, gap: 8 },
  sobretitulo: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#1e3a8a",
  },
  titulo: { fontSize: 24, fontWeight: "600" },
  detalle: { fontSize: 14, color: "#4b5563" },
  lista: { gap: 12, marginTop: 16 },
  tarjeta: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  tarjetaPresionada: { borderColor: "#1e3a8a", backgroundColor: "#eff6ff" },
  tarjetaRol: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#1e3a8a",
  },
  tarjetaTitulo: { fontSize: 16, fontWeight: "500" },
  tarjetaDetalle: { fontSize: 14, color: "#4b5563" },
});
