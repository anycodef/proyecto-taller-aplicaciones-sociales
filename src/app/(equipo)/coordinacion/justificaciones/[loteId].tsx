import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { VisorEvidencia } from "@/components/justificaciones/visor-evidencia";
import { Aviso, Boton, CampoTexto, Insignia, Tarjeta } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import { MOTIVO_RECHAZO_MAXIMO } from "@/lib/justificaciones/estados";
import { agruparPorNinoYFecha, AVISO_SIN_CONEXION, etiquetaFecha, nombresSesiones, unirNombres } from "@/lib/justificaciones/presentacion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { marcarBandejaDesactualizada } from "@/plataforma/justificaciones/bandeja-vigente";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { colores, espacio, tipografia } from "@/tema";

/** Lo que se va a rechazar: el motivo se pide recién al elegir rechazar. */
type Rechazo = { ids: string[]; descripcion: string };

/** Evidencia del lote y revisión de todo el lote o de cada ausencia; rechazar exige motivo (RF-403, RF-408). */
export default function DetalleLote() {
  const { loteId } = useLocalSearchParams<{ loteId: string }>();
  const api = useApiJustificaciones();
  const conectado = useConexion();
  const cargar = useCallback(async () => (await api.bandeja()).lotes.find((l) => l.loteId === loteId) ?? null, [api, loteId]);
  const { datos: lote, error, cargando, recargar } = useCarga(cargar, conectado === true);
  const [rechazo, setRechazo] = useState<Rechazo | null>(null);
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
      setRechazo(null);
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
  const grupos = agruparPorNinoYFecha(lote.justificaciones);
  const varios = grupos.length > 1;

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Tarjeta>
        <Text style={[tipografia.etiqueta, estilos.suave]}>Causa</Text>
        <Text style={tipografia.encabezado}>{ETIQUETAS_CAUSA[lote.causa]}</Text>
        <Text style={[tipografia.nota, estilos.suave]}>{`${unirNombres(lote.justificaciones.map((j) => j.nombre))} · enviada el ${etiquetaFecha(lote.enviadaEn)}`}</Text>
        {lote.canal === "coordinacion" ? <Insignia texto="Registrada por la coordinación" tono="neutro" /> : null}
      </Tarjeta>

      <View style={estilos.seccion}>
        <Text style={[tipografia.etiqueta, estilos.suave]}>Comprobante</Text>
        <VisorEvidencia justificacionId={lote.justificaciones[0].id} obtener={obtenerEvidencia} />
      </View>

      <View style={estilos.seccion}>
        <Text style={[tipografia.etiqueta, estilos.suave]}>{`Ausencias (${grupos.length})`}</Text>
        {grupos.map((grupo) => {
          const descripcion = `${grupo[0].nombre} · ${etiquetaFecha(grupo[0].fecha)}`;
          const ids = grupo.map((j) => j.id);
          return (
            <Tarjeta key={ids.join(",")}>
              <Text style={tipografia.cuerpoFuerte}>{descripcion}</Text>
              <View style={estilos.insignias}>
                {nombresSesiones(grupo).map((sesion) => <Insignia key={sesion} texto={sesion} tono="neutro" />)}
                {grupo.some((j) => j.anticipada) ? <Insignia texto="Aviso anticipado" tono="suave" /> : null}
                {grupo.some((j) => j.duplicada) ? <Insignia texto="Tiene otra justificación" tono="advertencia" /> : null}
              </View>
              {varios ? (
                <View style={estilos.fila}>
                  <View style={estilos.flex}>
                    <Boton etiqueta="Aprobar" variante="secundario" alPresionar={() => void decidir(ids, "aprobada")} deshabilitado={trabajando} />
                  </View>
                  <View style={estilos.flex}>
                    <Boton etiqueta="Rechazar" variante="secundario" alPresionar={() => setRechazo({ ids, descripcion })} deshabilitado={trabajando} />
                  </View>
                </View>
              ) : null}
            </Tarjeta>
          );
        })}
      </View>

      {rechazo ? (
        <Tarjeta tono="advertencia">
          <Text style={tipografia.cuerpoFuerte}>{`Rechazar: ${rechazo.descripcion}`}</Text>
          <Text style={[tipografia.nota, estilos.suave]}>El apoderado verá este motivo y podrá enviar otra mientras siga en plazo.</Text>
          <CampoTexto etiqueta="Motivo del rechazo" valor={motivo} alCambiar={setMotivo} maximoCaracteres={MOTIVO_RECHAZO_MAXIMO} marcador="Ej.: la foto no se lee" />
          <View style={estilos.fila}>
            <View style={estilos.flex}>
              <Boton etiqueta="Cancelar" variante="enlace" alPresionar={() => { setRechazo(null); setMotivo(""); }} />
            </View>
            <View style={estilos.flex}>
              <Boton etiqueta="Confirmar rechazo" alPresionar={() => void decidir(rechazo.ids, "rechazada")} deshabilitado={!motivo.trim() || trabajando} cargando={trabajando} />
            </View>
          </View>
        </Tarjeta>
      ) : (
        <View style={estilos.acciones}>
          <Boton etiqueta={varios ? "Aprobar todo" : "Aprobar"} alPresionar={() => void decidir(todas, "aprobada")} cargando={trabajando} />
          <Boton
            etiqueta={varios ? "Rechazar todo" : "Rechazar"}
            variante="secundario"
            alPresionar={() => setRechazo({ ids: todas, descripcion: varios ? `las ${grupos.length} ausencias` : `${grupos[0][0].nombre} · ${etiquetaFecha(grupos[0][0].fecha)}` })}
            deshabilitado={trabajando}
          />
        </View>
      )}
      {aviso ? <Aviso tono="error" mensaje={aviso} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  seccion: { gap: espacio.s },
  acciones: { gap: espacio.s },
  insignias: { flexDirection: "row", flexWrap: "wrap", gap: espacio.xs },
  fila: { flexDirection: "row", gap: espacio.s, marginTop: espacio.xs },
  flex: { flex: 1 },
  suave: { color: colores.textoSuave },
});
