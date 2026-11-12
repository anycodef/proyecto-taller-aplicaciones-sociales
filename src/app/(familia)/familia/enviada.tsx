import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Boton, PantallaResultado } from "@/components/ui";
import { colores, espacio, tipografia } from "@/tema";

function leerResumen(texto: string | undefined): string[] {
  try {
    const valor: unknown = JSON.parse(texto ?? "[]");
    return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Confirma la recepción en pantalla (RF-402); el resumen llega por parámetro y no se guarda. */
export default function JustificacionEnviada() {
  const { resumen } = useLocalSearchParams<{ resumen?: string }>();
  const lineas = leerResumen(resumen);
  return (
    <PantallaResultado
      tono="exito"
      titulo="Justificación recibida"
      icono={<Text style={estilos.glifo}>✓</Text>}
      mensaje="La coordinación la revisará. Verás si fue aceptada en «Mis justificaciones»."
      acciones={<Boton etiqueta="Volver al inicio" alPresionar={() => router.replace("/familia")} />}
    >
      <View style={estilos.lista}>
        {lineas.map((linea) => (
          <Text key={linea} style={[tipografia.cuerpo, { color: colores.texto }]}>{`• ${linea}`}</Text>
        ))}
      </View>
    </PantallaResultado>
  );
}

const estilos = StyleSheet.create({
  glifo: { ...tipografia.titulo, color: colores.primarioTexto },
  lista: { gap: espacio.xs },
});
