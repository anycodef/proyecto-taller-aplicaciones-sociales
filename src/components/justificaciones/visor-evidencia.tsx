import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { Aviso } from "@/components/ui";
import { colores, espacio, radio, tipografia } from "@/tema";

export interface PropiedadesVisorEvidencia {
  urls: readonly string[];
  /** Instante en que vence el enlace temporal; se muestra para que la coordinación sepa que no es permanente. */
  expiraEn?: string;
}

/**
 * Muestra las fotos de la evidencia sin guardarlas: `cachePolicy="none"` evita que queden en el disco
 * del dispositivo y el enlace firmado vence a los 5 minutos (RNF-403, RNF-404).
 */
export function VisorEvidencia({ urls, expiraEn }: PropiedadesVisorEvidencia) {
  if (urls.length === 0) return <Aviso tono="advertencia" mensaje="Esta justificación ya no tiene evidencia disponible." />;
  return (
    <View style={estilos.contenedor}>
      {urls.map((url, indice) => (
        <Image
          key={url}
          source={{ uri: url }}
          cachePolicy="none"
          contentFit="contain"
          accessibilityLabel={`Evidencia, foto ${indice + 1} de ${urls.length}`}
          style={estilos.foto}
        />
      ))}
      {expiraEn ? <Text style={[tipografia.nota, estilos.nota]}>El enlace de la foto es temporal y vence en pocos minutos.</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.m },
  foto: { width: "100%", aspectRatio: 3 / 4, borderRadius: radio.campo, backgroundColor: colores.neutroFondo },
  nota: { color: colores.textoTenue },
});
