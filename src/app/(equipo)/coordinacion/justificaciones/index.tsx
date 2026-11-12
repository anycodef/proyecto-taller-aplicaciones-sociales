import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SelectorAusencias } from "@/components/justificaciones/selector-ausencias";
import { Aviso, Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import { AVISO_SIN_CONEXION, etiquetaFecha, etiquetaSesiones } from "@/lib/justificaciones/presentacion";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

/** Una sola bandeja fuera del WhatsApp personal; solo en línea porque la evidencia nunca está en el celular (RNF-405). */
export default function BandejaJustificaciones() {
  const api = useApiJustificaciones();
  const { contexto } = useSesion();
  const puedeRevisar = contexto ? rolesEfectivos(contexto).includes("coordinacion") : false;
  const conectado = useConexion();
  const cargar = useCallback(() => api.bandeja(), [api]);
  const { datos, error, cargando, recargar } = useCarga(cargar, conectado === true);
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [aprobando, setAprobando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const aprobar = async () => {
    if (!seleccionadas.length) return;
    setAprobando(true);
    setAviso(null);
    try {
      await api.revisar(seleccionadas, "aprobada");
      setSeleccionadas([]);
      recargar();
    } catch {
      setAviso("No se aprobaron. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setAprobando(false);
    }
  };

  if (conectado === false) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={tipografia.titulo}>Justificaciones pendientes</Text>
      <View style={estilos.acciones}>
        {puedeRevisar ? <Boton etiqueta="Registrar una justificación" variante="secundario" alPresionar={() => router.push("/coordinacion/justificaciones/registrar")} /> : null}
        {puedeRevisar ? <Boton etiqueta="Plazo para justificar" variante="enlace" alPresionar={() => router.push("/coordinacion/justificaciones/plazo")} /> : null}
      </View>
      {cargando ? <Text style={[tipografia.cuerpo, estilos.suave]}>Cargando la bandeja…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {datos && !datos.lotes.length ? <Text style={[tipografia.cuerpo, estilos.suave]}>No hay justificaciones pendientes.</Text> : null}
      {datos?.lotes.map((lote) => (
        <View key={lote.loteId} style={estilos.lote}>
          <FilaNavegacion
            titulo={`${ETIQUETAS_CAUSA[lote.causa]}`}
            subtitulo={`Enviada el ${etiquetaFecha(lote.enviadaEn.slice(0, 10))}${lote.canal === "coordinacion" ? " · registrada por la coordinación" : ""} · ver evidencia`}
            alPresionar={() => router.push({ pathname: "/coordinacion/justificaciones/[loteId]", params: { loteId: lote.loteId } })}
          />
          {lote.justificaciones.some((j) => j.duplicada) ? <Insignia texto="Otra justificación para la misma ausencia" tono="advertencia" /> : null}
          {puedeRevisar ? (
            <SelectorAusencias
              opciones={lote.justificaciones.map((j) => ({ clave: j.id, titulo: `${j.nombre} · ${etiquetaFecha(j.fecha)}`, detalle: etiquetaSesiones([j]), ...(j.duplicada ? { nota: "Ausencia con otra justificación" } : {}) }))}
              seleccionadas={seleccionadas}
              alCambiar={setSeleccionadas}
            />
          ) : (
            lote.justificaciones.map((j) => <Text key={j.id} style={tipografia.cuerpo}>{`${j.nombre} · ${etiquetaFecha(j.fecha)} · ${etiquetaSesiones([j])}`}</Text>)
          )}
        </View>
      ))}
      {aviso ? <Aviso tono="error" mensaje={aviso} /> : null}
      {puedeRevisar && datos?.lotes.length ? (
        <Boton etiqueta={`Aprobar seleccionadas (${seleccionadas.length})`} alPresionar={() => void aprobar()} cargando={aprobando} deshabilitado={!seleccionadas.length} />
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  acciones: { gap: espacio.s },
  lote: { gap: espacio.s },
  suave: { color: colores.textoSuave },
});
