import { router, useLocalSearchParams, type Href } from "expo-router";
import { Text } from "react-native";

import { Boton, PantallaResultado } from "@/components/ui";
import { colores } from "@/tema";

/** Confirmación tras enviar (WEB-09): no promete aprobación, solo que la coordinación la revisará. */
export default function Enviada() {
  const { cantidad } = useLocalSearchParams<{ cantidad?: string }>();
  const total = Number(cantidad) || 1;
  return (
    <PantallaResultado
      tono="exito"
      titulo="Recibimos tu justificación"
      icono={<Text style={{ color: colores.primarioTexto, fontSize: 32 }}>✓</Text>}
      mensaje={`Enviaste ${total === 1 ? "1 justificación" : `${total} justificaciones`}. La coordinación las revisará y verás aquí su estado.`}
      acciones={
        <>
          <Boton etiqueta="Ver mis justificaciones" alPresionar={() => router.replace("/familia/mis-justificaciones" as Href)} />
          <Boton etiqueta="Volver al inicio" variante="secundario" alPresionar={() => router.replace("/familia")} />
        </>
      }
    />
  );
}
