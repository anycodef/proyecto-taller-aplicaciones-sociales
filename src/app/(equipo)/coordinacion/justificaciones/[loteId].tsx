import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { VisorEvidencia } from "@/components/justificaciones/visor-evidencia";
import { Aviso, Boton, CampoTexto, Tarjeta } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import { MOTIVO_RECHAZO_MAXIMO } from "@/lib/justificaciones/estados";
import { AVISO_SIN_CONEXION, etiquetaFecha, etiquetaSesiones } from "@/lib/justificaciones/presentacion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { marcarBandejaDesactualizada } from "@/plataforma/justificaciones/bandeja-vigente";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { colores, espacio, tipografia } from "@/tema";

/** Evidencia del lote y revisión de todo el lote o de una ausencia; rechazar exige motivo (RF-408). */
export default function DetalleLote() {
  const { loteId } = useLocalSearchParams<{ loteId: string }>();
  const api = useApiJustificaciones();
  const conectado = useConexion();
  const cargar = useCallback(async () => (await api.bandeja()).lotes.find((l) => l.loteId === loteId) ?? null, [api, loteId]);
  const { datos: lote, error, cargando, recargar } = useCarga(cargar, conectado === true);
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const obtenerEvidencia = useCallback((id: string) => api.evidencia(id), [api]);

  const decidir = async (ids: string[], decision: "aprobada" | "rechazada") => {
    if (decision === "rechazada" && !motivo.trim()) return;
    setTrabajando(true);
    setAviso(null);
    try {
      await api.revisar(ids, decision, decision === "rechazada" ? motivo.trim() : undefined);
      setMotivo("");
      marcarBandejaDesactualizada();
      if (lote && ids.length === lote.justificaciones.length) router.back();
      else recargar();
    } catch {
      setAviso("No se guardó la revisión. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setTrabajando(false);
    }
  };

  if (conectado === false) return <ScrollView contentContainerStyle={estilos.contenido}><Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} /></ScrollView>;
  if (cargando) return <Text style={[tipografia.cuerpo, estilos.contenido]}>Cargando…</Text>;
  if (error) return <ScrollView contentContainerStyle={estilos.contenido}><Aviso tono="error" mensaje={error} /></ScrollView>;
  if (!lote) return <ScrollView contentContainerStyle={estilos.contenido}><Aviso tono="informativo" mensaje="Este lote ya fue revisado." /></ScrollView>;

  const todas = lote.justificaciones.map((j) => j.id);
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={tipografia.titulo}>{ETIQUETAS_CAUSA[lote.causa]}</Text>
      <VisorEvidencia justificacionId={lote.justificaciones[0].id} obtener={obtenerEvidencia} />
      {lote.justificaciones.map((j) => (
        <Tarjeta key={j.id}>
          <Text style={tipografia.cuerpoFuerte}>{`${j.nombre} · ${etiquetaFecha(j.fecha)}`}</Text>
          <Text style={[tipografia.nota, estilos.suave]}>{`${etiquetaSesiones([j])}${j.anticipada ? " · aviso anticipado" : ""}${j.duplicada ? " · tiene otra justificación" : ""}`}</Text>
          {lote.justificaciones.length > 1 ? (
            <Boton etiqueta={`Aprobar solo esta (${j.nombre})`} variante="enlace" alPresionar={() => void decidir([j.id], "aprobada")} deshabilitado={trabajando} />
          ) : null}
        </Tarjeta>
      ))}
      <Boton etiqueta="Aprobar todo el lote" alPresionar={() => void decidir(todas, "aprobada")} cargando={trabajando} />
      <View style={estilos.rechazo}>
        <CampoTexto etiqueta="Motivo del rechazo" valor={motivo} alCambiar={setMotivo} maximoCaracteres={MOTIVO_RECHAZO_MAXIMO} marcador="Ej.: la foto no se lee" />
        <Boton etiqueta="Rechazar el lote" variante="secundario" alPresionar={() => void decidir(todas, "rechazada")} deshabilitado={!motivo.trim() || trabajando} />
      </View>
      {aviso ? <Aviso tono="error" mensaje={aviso} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  rechazo: { gap: espacio.s },
  suave: { color: colores.textoSuave },
});
