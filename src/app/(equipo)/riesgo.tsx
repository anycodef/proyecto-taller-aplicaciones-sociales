import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { TarjetaRiesgo } from "@/components/riesgo/tarjeta-riesgo";
import { Aviso, Boton } from "@/components/ui";
import { crearApiRiesgo } from "@/lib/riesgo/api";
import { tituloDePaso } from "@/lib/riesgo/explicacion";
import type { Paso } from "@/lib/riesgo/tipos";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const ORDEN_PASOS: readonly Paso[] = ["alerta_retiro", "citacion", "contacto", "seguimiento"];

/**
 * Lista de riesgo de deserción (RF-707): la coordinación ve todos los grupos y el catequista solo los suyos,
 * porque el servidor ya filtra. Se muestra por paso, con las faltas que lo originaron (RNF-702); no se recalcula nada.
 */
export default function Riesgo() {
  const { cliente } = useSesion();
  const api = useMemo(() => crearApiRiesgo(cliente), [cliente]);
  const { datos, error, cargando, recargar } = useCarga(api.listarRiesgo);

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Riesgo de deserción</Text>
      <Text style={[tipografia.cuerpo, estilos.suave]}>
        {datos ? (datos.length === 0 ? "Nadie está en riesgo hoy" : `${datos.length} ${datos.length === 1 ? "niño en riesgo" : "niños en riesgo"}`) : "Calculada en el servidor"}
      </Text>

      {cargando && !datos ? <Text style={[tipografia.cuerpo, estilos.suave]}>Calculando…</Text> : null}
      {error ? (
        <View style={estilos.bloque}>
          <Aviso tono="error" mensaje={error} />
          <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} />
        </View>
      ) : null}
      {datos && datos.length === 0 ? <Aviso tono="informativo" mensaje="Nadie está en riesgo hoy. Las faltas que aún están dentro del plazo de justificación no suman." /> : null}

      {ORDEN_PASOS.map((paso) => {
        const filas = datos?.filter((fila) => fila.paso === paso) ?? [];
        if (filas.length === 0) return null;
        return (
          <View key={paso} style={estilos.bloque}>
            <Text style={[tipografia.encabezado, estilos.titulo]}>
              {tituloDePaso(paso)} ({filas.length})
            </Text>
            {filas.map((fila) => (
              <TarjetaRiesgo key={fila.catequizandoId} fila={fila} />
            ))}
          </View>
        );
      })}

      {datos ? <Boton etiqueta="Actualizar" variante="secundario" alPresionar={recargar} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  bloque: { gap: espacio.m },
});
