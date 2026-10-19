import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Tarjeta } from "@/components/ui";
import { colores, espacio, tipografia } from "@/tema";

export default function SinAcceso({ rechazados }: { rechazados?: string | number }) {
  const cantidad = Number(rechazados ?? 0);

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.centro}>
        <View style={estilos.icono}>
          <Text style={estilos.glifo}>🔗</Text>
        </View>
        <Text style={[tipografia.titulo, estilos.titulo]}>No pudimos abrir tu acceso</Text>
        <Text style={[tipografia.cuerpo, estilos.texto]}>
          Este enlace ya no es válido. Pide uno nuevo a la coordinación.
        </Text>

        {cantidad > 0 ? (
          <Aviso
            tono="advertencia"
            mensaje={`${cantidad} ${cantidad === 1 ? "registro de este celular no pudo enviarse" : "registros de este celular no pudieron enviarse"}. La coordinación ya fue avisada.`}
          />
        ) : null}

        <Tarjeta>
          <Text style={[tipografia.cuerpoFuerte, estilos.negrita]}>Qué hacer</Text>
          <Text style={[tipografia.cuerpo, estilos.texto]}>
            Pide un enlace nuevo a la coordinación y ábrelo en este mismo celular. Si el problema
            sigue, avisa a la coordinación.
          </Text>
        </Tarjeta>

        <Boton etiqueta="Entendido" alPresionar={() => router.replace("/")} />
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl },
  centro: { flex: 1, justifyContent: "center", gap: espacio.l },
  icono: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colores.primarioSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  glifo: { fontSize: 28 },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  negrita: { color: colores.texto },
});
