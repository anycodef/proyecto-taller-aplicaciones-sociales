import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta } from "@/components/ui";
import { CompartirEnlace } from "@/components/seguridad/compartir-enlace";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const ETIQUETA_ROL: Record<string, string> = {
  administracion: "Administración",
  coordinacion: "Coordinación",
  catequista: "Catequista",
  familia: "Familia",
  supervision: "Supervisión",
};

export default function FichaCuenta({ id }: { id: string }) {
  const { api } = useSesion();
  const cuentaId = id ?? "";
  const cargar = useCallback(() => api.leerCuenta(cuentaId), [api, cuentaId]);
  const { datos, error, cargando, recargar } = useCarga(cargar);
  const [mensaje, setMensaje] = useState<string | null>(null);

  if (cargando) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Cargando la cuenta…</Text>
      </ScrollView>
    );
  }

  if (error || !datos) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.nota, estilos.error]}>{error ?? "No encontramos la cuenta."}</Text>
        <Boton etiqueta="Volver" variante="secundario" alPresionar={() => router.replace("/cuentas")} />
      </ScrollView>
    );
  }

  const tipoEnlace = datos.roles.includes("familia") && !datos.roles.some((rol) => rol !== "familia")
    ? "familia"
    : "equipo";

  const revocar = () => {
    Alert.alert(
      "Revocar el enlace",
      `El enlace de ${datos.identidadOperativa} dejará de funcionar en la siguiente petición.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revocar",
          style: "destructive",
          onPress: () => {
            void api.revocarEnlace(datos.id).then(() => {
              setMensaje("Enlace revocado.");
              recargar();
            });
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>{datos.identidadOperativa}</Text>

      <View style={estilos.insignias}>
        {datos.roles.map((rol) => (
          <Insignia key={rol} texto={ETIQUETA_ROL[rol] ?? rol} tono="suave" />
        ))}
        <Insignia texto={datos.activa ? "Activa" : "Desactivada"} tono={datos.activa ? "solido" : "error"} />
      </View>

      {datos.esMenor ? (
        <Aviso tono="informativo" mensaje="Es menor de edad: en cualquier vista solo verás su seudónimo." />
      ) : null}

      {mensaje ? <Aviso tono="informativo" mensaje={mensaje} /> : null}

      <Tarjeta>
        <Text style={[tipografia.cuerpoFuerte, estilos.negrita]}>Enlace de acceso</Text>
        <Text style={[tipografia.cuerpo, estilos.texto]}>
          El enlace se envía por el canal que ya usa la familia. No se guarda en el servidor y solo se
          muestra una vez.
        </Text>
        <CompartirEnlace
          cuentaId={datos.id}
          tipo={tipoEnlace}
          alGenerar={recargar}
        />
        <Boton etiqueta="Revocar el enlace" variante="secundario" alPresionar={revocar} />
      </Tarjeta>

      <Boton etiqueta="Volver a las cuentas" variante="enlace" alPresionar={() => router.replace("/cuentas")} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  negrita: { color: colores.texto },
  error: { color: colores.errorTexto },
  insignias: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s },
});
