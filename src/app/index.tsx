import { useEffect, useState } from "react";
import { router, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton, Tarjeta } from "@/components/ui";
import { extraerTokenDeUrl } from "@/lib/seguridad/enlaces";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { guardarTokenPendiente } from "@/plataforma/seguridad/sesion";
import { colores, espacio, radio, tipografia } from "@/tema";

/** A donde entra cada rol cuando ya tiene sesion. */
export function inicioDelRol(tipo: string, roles: string[]): Href {
  if (tipo === "familia") return "/familia";
  if (roles.includes("coordinacion")) return "/coordinacion";
  return "/asistencia";
}

export default function Inicio() {
  const { cargando, tipo, rolesEfectivos } = useSesion();
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (cargando || tipo === "ninguna") return;
    router.replace(inicioDelRol(tipo, rolesEfectivos));
  }, [cargando, tipo, rolesEfectivos]);

  const pegarEnlace = async () => {
    const texto = await Clipboard.getStringAsync();
    const token = texto ? extraerTokenDeUrl(texto) : null;
    if (!token) {
      setAviso("No encontramos un enlace de SIGECAT en el portapapeles.");
      return;
    }
    guardarTokenPendiente(token);
    router.push("/acceso/equipo");
  };

  if (cargando) {
    return (
      <View style={estilos.pantalla}>
        <Text style={[tipografia.cuerpo, estilos.aviso]}>Abriendo tu sesión…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.marca}>
        <Text style={estilos.marcaSigno}>+</Text>
      </View>
      <Text style={[tipografia.titulo, estilos.titulo]}>SIGECAT</Text>
      <Text style={[tipografia.cuerpo, estilos.subtitulo]}>Gestión y seguimiento catequético</Text>

      <Tarjeta>
        <Text style={estilos.glifo}>🔗</Text>
        <Text style={[tipografia.encabezado, estilos.tituloTarjeta]}>Abre tu enlace personal</Text>
        <Text style={[tipografia.cuerpo, estilos.textoSuave]}>
          La coordinación te lo envía por WhatsApp. Tócalo y la app se abre sola.
        </Text>
      </Tarjeta>

      {aviso ? <Text style={[tipografia.nota, estilos.aviso]}>{aviso}</Text> : null}

      {Platform.OS === "android" ? (
        <Boton etiqueta="Pegar enlace" variante="secundario" alPresionar={() => void pegarEnlace()} />
      ) : null}

      <Text style={[tipografia.nota, estilos.pie]}>
        ¿Aún no tienes enlace? Pídelo a la coordinación.
      </Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo, justifyContent: "center", padding: espacio.xl },
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  marca: {
    width: 56,
    height: 56,
    borderRadius: radio.campo,
    backgroundColor: colores.primario,
    alignItems: "center",
    justifyContent: "center",
  },
  marcaSigno: { color: colores.primarioTexto, fontSize: 30, fontWeight: "300", lineHeight: 34 },
  titulo: { color: colores.texto },
  subtitulo: { color: colores.textoSuave, marginBottom: espacio.xl },
  glifo: { fontSize: 24, marginBottom: espacio.s },
  tituloTarjeta: { color: colores.texto },
  textoSuave: { color: colores.textoSuave },
  aviso: { color: colores.errorTexto },
  pie: { color: colores.textoTenue, textAlign: "center" },
});
