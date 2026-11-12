import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FilaNavegacion } from "@/components/ui";
import { modulosDelPanel } from "@/lib/navegacion/modulos";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const OPCIONES: { titulo: string; subtitulo: string; ruta: Href }[] = [
  { titulo: "Cuentas", subtitulo: "Altas, roles y enlaces de acceso", ruta: "/cuentas" },
  { titulo: "Delegaciones", subtitulo: "Continuidad del equipo dominical", ruta: "/delegaciones" },
  { titulo: "Auditoría", subtitulo: "Quién consultó qué", ruta: "/auditoria" },
  { titulo: "Avisos del sistema", subtitulo: "Alertas para la coordinación", ruta: "/avisos-sistema" },
  { titulo: "Grupos", subtitulo: "Grupos del ciclo y conteo de niños", ruta: "/coordinacion/grupos" as Href },
  { titulo: "Catequizandos", subtitulo: "Los niños por grupo: perfil, asistencia y documentos", ruta: "/mis-catequizandos" as Href },
  { titulo: "Pasar lista", subtitulo: "Vista del catequista", ruta: "/asistencia" },
  { titulo: "Asistente de catequesis", subtitulo: "Preguntas de doctrina con fuentes públicas", ruta: "/asistente" as Href },
];

export default function Coordinacion() {
  const { rolesEfectivos } = useSesion();
  const modulos = modulosDelPanel("coordinacion", rolesEfectivos);

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
        {modulos.conectados.map((modulo) => (
          <FilaNavegacion
            key={modulo.id}
            titulo={modulo.titulo}
            subtitulo={modulo.subtitulo}
            alPresionar={() => router.push(modulo.ruta as Href)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  lista: { gap: espacio.s },
});
