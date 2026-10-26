import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FilaNavegacion } from "@/components/ui";
import { Pendiente } from "@/components/pendiente";
import { colores, espacio, tipografia } from "@/tema";

const OPCIONES: { titulo: string; subtitulo: string; ruta: Href }[] = [
  { titulo: "Cuentas", subtitulo: "Altas, roles y enlaces de acceso", ruta: "/cuentas" },
  { titulo: "Delegaciones", subtitulo: "Continuidad del equipo dominical", ruta: "/delegaciones" },
  { titulo: "Auditoría", subtitulo: "Quién consultó qué", ruta: "/auditoria" },
  { titulo: "Avisos del sistema", subtitulo: "Alertas para la coordinación", ruta: "/avisos-sistema" },
  { titulo: "Pasar lista", subtitulo: "Vista del catequista", ruta: "/asistencia" },
];

export default function Coordinacion() {
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Panel del ciclo</Text>
      <Text style={[tipografia.cuerpo, estilos.suave]}>
        Lo que hoy se resuelve a mano en Excel y WhatsApp.
      </Text>

      <View style={estilos.lista}>
        {OPCIONES.map((opcion) => (
          <FilaNavegacion
            key={opcion.titulo}
            titulo={opcion.titulo}
            subtitulo={opcion.subtitulo}
            alPresionar={() => router.push(opcion.ruta)}
          />
        ))}
      </View>

      <Text style={[tipografia.encabezado, estilos.titulo]}>Próximamente</Text>
      <Pendiente
        items={[
          "Asistencia consolidada por grupo contra el mínimo del ciclo",
          "Bandeja de justificaciones con la lectura OCR ya resuelta",
          "Catequizandos con señal de riesgo de deserción",
          "Alta de grupos, catequistas e inscripciones con consentimiento",
        ]}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  lista: { gap: espacio.s },
});
