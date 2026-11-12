import { Pressable, StyleSheet, Text, View } from "react-native";

import { Insignia, Tarjeta } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import type { LoteBandeja } from "@/lib/justificaciones/cliente-justificaciones";
import { etiquetaSesion, fechaCorta } from "@/lib/justificaciones/seleccion";
import { alturaMinimaToque, colores, espacio, tipografia } from "@/tema";

export interface PropiedadesTarjetaLote {
  lote: LoteBandeja;
  alPresionar: () => void;
}

/** Resumen de un lote de la bandeja: niño, causa, cuántas ausencias y si alguna está duplicada (RF-403, RF-408). */
export function TarjetaLote({ lote, alPresionar }: PropiedadesTarjetaLote) {
  const primera = lote.justificaciones[0];
  if (!primera) return null;
  const duplicadas = lote.justificaciones.filter((j) => j.duplicada).length;
  const ninos = [...new Set(lote.justificaciones.map((j) => j.nombre))];
  return (
    <Pressable accessibilityRole="button" onPress={alPresionar} style={({ pressed }) => (pressed ? estilos.presionada : null)}>
      <Tarjeta>
        <View style={estilos.cabecera}>
          <Text style={[tipografia.cuerpoFuerte, estilos.titulo]}>{ninos.join(", ")}</Text>
          <Insignia texto={`${lote.justificaciones.length} ${lote.justificaciones.length === 1 ? "ausencia" : "ausencias"}`} tono="suave" />
        </View>
        <Text style={[tipografia.cuerpo, estilos.suave]}>{ETIQUETAS_CAUSA[primera.causa]}</Text>
        <Text style={[tipografia.nota, estilos.suave]}>
          {lote.justificaciones.map((j) => `${etiquetaSesion(j.tipoSesion)} ${fechaCorta(j.fecha)}`).join(" · ")}
        </Text>
        {duplicadas > 0 ? <Insignia texto="Posible duplicada" tono="advertencia" /> : null}
        {primera.canal === "coordinacion" ? <Insignia texto="Registrada por coordinación" tono="neutro" /> : null}
      </Tarjeta>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  presionada: { opacity: 0.85 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.m, minHeight: alturaMinimaToque },
  titulo: { flex: 1, color: colores.texto },
  suave: { color: colores.textoSuave },
});
