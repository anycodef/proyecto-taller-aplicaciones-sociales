import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { TarjetaLote } from "@/components/justificaciones/tarjeta-lote";
import { Aviso, Boton } from "@/components/ui";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api-justificaciones";
import { colores, espacio, tipografia } from "@/tema";

/** Bandeja de la coordinación: justificaciones pendientes agrupadas por lote (RF-403, RF-408). */
export default function BandejaJustificaciones() {
  const api = useApiJustificaciones();
  const { datos, error, cargando, recargar } = useCarga(api.bandeja);

  // Al volver del detalle de un lote la bandeja ya no debe mostrar lo que se acaba de revisar.
  useFocusEffect(useCallback(() => recargar(), [recargar]));

  const total = datos?.reduce((suma, lote) => suma + lote.justificaciones.length, 0) ?? 0;

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Justificaciones</Text>
      <Text style={[tipografia.cuerpo, estilos.suave]}>
        {datos ? (total === 0 ? "No hay justificaciones por revisar." : `${total} por revisar en ${datos.length} ${datos.length === 1 ? "lote" : "lotes"}.`) : "Cargando…"}
      </Text>

      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {cargando && !datos ? <Text style={[tipografia.cuerpo, estilos.suave]}>Cargando…</Text> : null}

      <View style={estilos.lista}>
        {datos?.map((lote) => (
          <TarjetaLote key={lote.loteId} lote={lote} alPresionar={() => router.push(`/coordinacion/justificaciones/${lote.loteId}` as Href)} />
        ))}
      </View>

      <Boton etiqueta="Actualizar" variante="secundario" alPresionar={recargar} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  lista: { gap: espacio.m },
});
