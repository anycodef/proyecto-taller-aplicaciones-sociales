import { useEffect, useState } from "react";
import { router, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton, Tarjeta } from "@/components/ui";
import { leerEnlaceAcceso } from "@/lib/seguridad/enlaces";
import {
  muestraPegarEnlace,
  TARJETA_INICIO,
  varianteDe,
} from "@/lib/seguridad/variantes-plataforma";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { guardarTokenPendiente } from "@/plataforma/seguridad/sesion";
import { colores, espacio, radio, tipografia } from "@/tema";

/** A donde entra cada rol cuando ya tiene sesion. */
export function inicioDelRol(tipo: string, roles: string[]): Href {
  if (tipo === "familia") return "/familia";
  if (roles.includes("administracion")) return "/cuentas";
  if (roles.includes("coordinacion")) return "/coordinacion";
  return "/asistencia";
}

export default function Inicio() {
  const { cargando, tipo, rolesEfectivos, desbloqueada } = useSesion();
  const [aviso, setAviso] = useState<string | null>(null);
  const variante = varianteDe(Platform.OS);

  useEffect(() => {
    if (cargando || tipo === "ninguna") return;
    router.replace(tipo === "equipo" && !desbloqueada ? "/acceso/desbloquear" : inicioDelRol(tipo, rolesEfectivos));
  }, [cargando, tipo, rolesEfectivos, desbloqueada]);

  const pegarEnlace = async () => {
    const texto = await Clipboard.getStringAsync();
    const enlace = texto ? leerEnlaceAcceso(texto) : null;
    if (!enlace) {
      setAviso("No encontramos un enlace de SIGECAT en el portapapeles.");
      return;
    }
    guardarTokenPendiente(enlace.token);
    router.push(enlace.tipo === "familia" ? "/acceso/familia" : "/acceso/equipo");
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
        <Text style={[tipografia.cuerpo, estilos.textoSuave]}>{TARJETA_INICIO[variante]}</Text>
      </Tarjeta>

      {aviso ? <Text style={[tipografia.nota, estilos.aviso]}>{aviso}</Text> : null}

      {muestraPegarEnlace(Platform.OS) ? (
        <Boton etiqueta="Pegar enlace" variante="secundario" alPresionar={() => void pegarEnlace()} />
      ) : null}

      <Text style={[tipografia.nota, estilos.pie]}>
        ¿Aún no tienes enlace? Pídelo a la coordinación.
      </Text>
      {/* Herramientas de desarrollo: solo con EXPO_PUBLIC_HERRAMIENTAS_DEV=1; en la demo no se ven. */}
      {__DEV__ && process.env.EXPO_PUBLIC_HERRAMIENTAS_DEV === "1" ? (
        <>
          <Boton etiqueta="Galería de componentes" variante="enlace" alPresionar={() => router.push("/galeria")} />
          <Boton
            etiqueta="Navegación de pantallas"
            variante="secundario"
            alPresionar={() => router.push("/navegacion" as Href)}
          />
        </>
      ) : null}
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
