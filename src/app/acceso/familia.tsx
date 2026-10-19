import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { useURL } from "expo-linking";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton } from "@/components/ui";
import { extraerTokenDeUrl } from "@/lib/seguridad/enlaces";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

type Estado = "entrando" | "error";

/** Quita el fragmento con el token de la barra de direcciones. */
export function borrarFragmentoDeLaUrl(): void {
  if (typeof window === "undefined" || !window.history || !window.location) return;
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url.toString());
}

export default function EntradaFamilia() {
  const { gestor, iniciarSesion } = useSesion();
  const url = useURL();
  const [estado, setEstado] = useState<Estado>("entrando");

  const entrar = useCallback(async () => {
    const token = url ? extraerTokenDeUrl(url) : null;
    if (!token) {
      setEstado("error");
      return;
    }
    try {
      const sesion = await gestor.entrarFamilia(token);
      borrarFragmentoDeLaUrl();
      iniciarSesion("familia", sesion.contexto, sesion.jwt);
      router.replace("/familia");
    } catch {
      setEstado("error");
    }
  }, [gestor, iniciarSesion, url]);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      await entrar();
      if (!vigente) return;
    })();
  }, [entrar]);

  if (estado === "error") {
    return (
      <Marco>
        <Text style={[tipografia.encabezado, estilos.titulo]}>No pudimos abrir tu acceso</Text>
        <Text style={[tipografia.cuerpo, estilos.texto]}>
          Pide un enlace nuevo a la coordinación y vuelve a abrirlo en este navegador.
        </Text>
        <Boton etiqueta="Reintentar" variante="secundario" alPresionar={() => setEstado("entrando")} />
      </Marco>
    );
  }

  return (
    <Marco>
      <ActivityIndicator size="large" color={colores.primario} />
      <Text style={[tipografia.cuerpo, estilos.texto]}>Abriendo tu acceso…</Text>
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.centro}>{children}</View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl },
  centro: { flex: 1, justifyContent: "center", gap: espacio.l, alignItems: "center" },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
});
