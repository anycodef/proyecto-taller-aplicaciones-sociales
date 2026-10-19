import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { useURL } from "expo-linking";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton } from "@/components/ui";
import { extraerTokenDeUrl } from "@/lib/seguridad/enlaces";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { leerTokenPendiente } from "@/plataforma/seguridad/sesion";
import { colores, espacio, tipografia } from "@/tema";

type Estado = "verificando" | "sin_red" | "sin_token" | "error";

export default function ActivacionEquipo() {
  const { gestor, guardarActivacion } = useSesion();
  const url = useURL();
  const [estado, setEstado] = useState<Estado>("verificando");

  const activar = useCallback(async (): Promise<Estado> => {
    const token = (url ? extraerTokenDeUrl(url) : null) ?? leerTokenPendiente();
    if (!token) return "sin_token";
    try {
      const activacion = await gestor.activarEquipo(token);
      guardarActivacion(activacion);
      router.replace("/acceso/fijar-pin");
      return "verificando";
    } catch (error) {
      return esErrorDeRed(error) ? "sin_red" : "error";
    }
  }, [gestor, guardarActivacion, url]);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const resultado = await activar();
      if (vigente) setEstado(resultado);
    })();
  }, [activar]);

  const reintentar = () => {
    setEstado("verificando");
    void (async () => {
      const resultado = await activar();
      setEstado(resultado);
    })();
  };

  if (estado === "sin_token") {
    return (
      <Marco>
        <Text style={[tipografia.encabezado, estilos.titulo]}>
          {Platform.OS === "web" ? "Instala la app en tu celular" : "No encontramos tu enlace"}
        </Text>
        <Text style={[tipografia.cuerpo, estilos.texto]}>
          {Platform.OS === "web"
            ? "Este enlace abre la app de SIGECAT. Ábrelo en el celular donde la uses: el sistema te ofrece instalarla y la app se abre sola para activar tu cuenta."
            : "Abre el enlace que te envió la coordinación. Si lo pegaste a mano, vuelve a pegarlo desde la pantalla de inicio."}
        </Text>
      </Marco>
    );
  }

  return (
    <Marco>
      <Text style={[tipografia.etiqueta, estilos.etiqueta]}>ACTIVAR MI CUENTA</Text>
      {estado === "verificando" ? (
        <>
          <ActivityIndicator size="large" color={colores.primario} style={estilos.cargador} />
          <Text style={[tipografia.encabezado, estilos.titulo]}>Verificando tu enlace…</Text>
          <Text style={[tipografia.cuerpo, estilos.texto]}>
            Esto toma unos segundos. No cierres la app.
          </Text>
        </>
      ) : null}

      {estado === "sin_red" ? (
        <>
          <Text style={[tipografia.encabezado, estilos.titulo]}>Verificando tu enlace…</Text>
          <Text style={[tipografia.cuerpo, estilos.texto]}>
            Esto toma unos segundos. No cierres la app.
          </Text>
          <Aviso
            tono="advertencia"
            mensaje="La primera vez necesitas internet. Si falla, conéctate a datos o wifi y vuelve a abrir el enlace: sigue funcionando."
          />
          <Boton etiqueta="Reintentar" variante="secundario" alPresionar={reintentar} />
        </>
      ) : null}

      {estado === "error" ? (
        <>
          <Text style={[tipografia.encabezado, estilos.titulo]}>No pudimos abrir tu acceso</Text>
          <Text style={[tipografia.cuerpo, estilos.texto]}>
            Pide un enlace nuevo a la coordinación y vuelve a abrirlo en este celular.
          </Text>
          <Boton etiqueta="Reintentar" variante="secundario" alPresionar={reintentar} />
        </>
      ) : null}
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

function esErrorDeRed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const mensaje = "message" in error ? String((error as { message: unknown }).message) : "";
  return /network|fetch|red|timeout/i.test(mensaje);
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl },
  centro: { flex: 1, justifyContent: "center", gap: espacio.l },
  cargador: { marginVertical: espacio.xl },
  etiqueta: { color: colores.primario, textTransform: "uppercase", letterSpacing: 1 },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
});
