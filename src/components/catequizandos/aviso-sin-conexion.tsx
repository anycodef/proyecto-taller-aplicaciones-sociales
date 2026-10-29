import { Aviso } from "@/components/ui";
import { colores, espacio } from "@/tema";
import { StyleSheet, View } from "react-native";

export function AvisoSinConexion({ mensaje }: { mensaje?: string }) {
  return (
    <Aviso tono="advertencia" mensaje={mensaje ?? "Inscribir requiere conexión"} />
  );
}

const estilos = StyleSheet.create({});
