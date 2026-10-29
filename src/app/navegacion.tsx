import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FilaNavegacion } from "@/components/ui";
import { colores, espacio, tipografia } from "@/tema";

const SECCIONES: {
  titulo: string;
  items: { titulo: string; subtitulo: string; ruta: string; movil?: boolean; web?: boolean }[];
}[] = [
  {
    titulo: "Acceso (público)",
    items: [
      {
        titulo: "Inicio / entrada por enlace",
        subtitulo: "Abre tu enlace personal o pégalo desde el portapapeles",
        ruta: "/",
        movil: true,
        web: true,
      },
      {
        titulo: "Activar cuenta (equipo)",
        subtitulo: "Verificación de enlace del equipo",
        ruta: "/acceso/equipo",
        movil: true,
      },
      {
        titulo: "Fijar PIN",
        subtitulo: "Teclado numérico de 4 a 6 dígitos",
        ruta: "/acceso/fijar-pin",
        movil: true,
      },
      {
        titulo: "Desbloqueo",
        subtitulo: "Ingresa tu PIN y días sin conexión",
        ruta: "/acceso/desbloquear",
        movil: true,
      },
      {
        titulo: "Acceso denegado",
        subtitulo: "Pantalla genérica de error de acceso",
        ruta: "/acceso/sin-acceso",
        movil: true,
        web: true,
      },
    ],
  },
  {
    titulo: "Equipo (COORD / CATEQUISTA) - móvil",
    items: [
      {
        titulo: "Panel del ciclo (coordinación)",
        subtitulo: "Cuentas, delegaciones, auditoría, avisos, pasar lista",
        ruta: "/coordinacion",
        movil: true,
      },
      {
        titulo: "Lista de cuentas",
        subtitulo: "Altas, roles y estado de cuentas",
        ruta: "/cuentas",
        movil: true,
      },
      {
        titulo: "Nueva cuenta",
        subtitulo: "Alta de cuenta con rol, seudónimo e identidad real",
        ruta: "/cuentas/nueva",
        movil: true,
      },
      {
        titulo: "Ficha de cuenta",
        subtitulo: "Identidad operativa, roles y enlace de acceso",
        ruta: "/cuentas/[id]",
        movil: true,
      },
      {
        titulo: "Delegaciones",
        subtitulo: "Lista y alta de delegaciones de coordinación",
        ruta: "/delegaciones",
        movil: true,
      },
      {
        titulo: "Nueva delegación",
        subtitulo: "Crea una delegación con periodo de vigencia",
        ruta: "/delegaciones/nueva",
        movil: true,
      },
      {
        titulo: "Auditoría",
        subtitulo: "Quién consultó qué (ADM)",
        ruta: "/auditoria",
        movil: true,
      },
      {
        titulo: "Avisos del sistema",
        subtitulo: "Alertas para la coordinación",
        ruta: "/avisos-sistema",
        movil: true,
      },
      {
        titulo: "Pasar lista",
        subtitulo: "Vista del catequista",
        ruta: "/asistencia",
        movil: true,
      },
    ],
  },
  {
    titulo: "Perfil e inscripción del catequizando (002)",
    items: [
      {
        titulo: "Lista de catequizandos",
        subtitulo: "Nomina con búsqueda y grupos",
        ruta: "/catequizandos",
        movil: true,
      },
      {
        titulo: "Perfil de niño",
        subtitulo: "Nombre, edad, grupo, apoderados y documentos",
        ruta: "/catequizandos/[id]",
        movil: true,
      },
      {
        titulo: "Carné individual",
        subtitulo: "QR SGC1 y número de emisión",
        ruta: "/catequizandos/[id]/carne",
        movil: true,
      },
      {
        titulo: "Grupos de coordinación",
        subtitulo: "Conteo de niños y aviso de grupo sin catequista",
        ruta: "/coordinacion/grupos",
        movil: true,
      },
      {
        titulo: "Nuevo grupo",
        subtitulo: "Crea un grupo con rango de edad y modalidad",
        ruta: "/coordinacion/grupos/nuevo",
        movil: true,
      },
      {
        titulo: "Carnés del grupo (imprimible)",
        subtitulo: "Hoja con QR para imprimir o guardar como PDF",
        ruta: "/coordinacion/grupos/[id]/carnes",
        movil: true,
      },
    ],
  },
  {
    titulo: "Familia (web)",
    items: [
      {
        titulo: "Entrada familiar (web)",
        subtitulo: "Lee el enlace #t= y entra sin instalar la app",
        ruta: "/acceso/familia",
        web: true,
      },
      {
        titulo: "Mi hijo o hija (familia)",
        subtitulo: "Solo perfil del propio hijo (web)",
        ruta: "/familia",
        web: true,
      },
    ],
  },
  {
    titulo: "Referencia visual",
    items: [
      {
        titulo: "Galería de componentes",
        subtitulo: "Botones, avisos, filas, teclado PIN, consentimiento, carné",
        ruta: "/galeria",
        movil: true,
        web: true,
      },
    ],
  },
];

function etiquetaPlataforma(item: { movil?: boolean; web?: boolean }) {
  const partes: string[] = [];
  if (item.movil) partes.push("Móvil");
  if (item.web) partes.push("Web");
  return partes.join(" + ");
}

export default function Navegacion() {
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.header}>
        <Text style={[tipografia.titulo, estilos.titulo]}>SIGECAT — Navegación</Text>
        <Text style={[tipografia.cuerpo, estilos.subtitulo]}>
          Todas las pantallas implementadas. Toca cualquiera para verla.
        </Text>
      </View>

      {SECCIONES.map((seccion) => (
        <View key={seccion.titulo} style={estilos.seccion}>
          <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>{seccion.titulo}</Text>
          {seccion.items.map((item) => (
            <FilaNavegacion
              key={item.ruta}
              titulo={item.titulo}
              subtitulo={`${item.subtitulo}  ·  ${etiquetaPlataforma(item)}`}
              alPresionar={() => router.push(item.ruta as Href)}
            />
          ))}
        </View>
      ))}

      <View style={estilos.pie}>
        <Text style={[tipografia.nota, estilos.nota]}>
          Las pantallas marcadas como &quot;Web&quot; están pensadas para Static Web Apps
          (familia). Las de &quot;Móvil&quot; requieren sesión de equipo y funcionan en Expo Go /
          build nativo.
        </Text>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  header: { gap: espacio.s },
  titulo: { color: colores.texto },
  subtitulo: { color: colores.textoSuave },
  seccion: { gap: espacio.s },
  tituloSeccion: { color: colores.primario, marginBottom: espacio.xs },
  pie: { marginTop: espacio.xl },
  nota: { color: colores.textoTenue, fontSize: 13 },
});
