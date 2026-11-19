import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import { agruparPorNinoYFecha, AVISO_SIN_CONEXION, etiquetaFecha, etiquetaFechaCorta, etiquetaSesiones, unirNombres } from "@/lib/justificaciones/presentacion";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useVersionBandeja } from "@/plataforma/justificaciones/bandeja-vigente";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, radio, tipografia } from "@/tema";

/** Una sola bandeja fuera del WhatsApp personal; solo en línea porque la evidencia nunca está en el celular (RNF-405). */
export default function BandejaJustificaciones() {
  const api = useApiJustificaciones();
  const { contexto } = useSesion();
  const puedeRevisar = contexto ? rolesEfectivos(contexto).includes("coordinacion") : false;
  const conectado = useConexion();
  const version = useVersionBandeja();
  // version no se usa dentro, pero al cambiar crea otro cargar y useCarga vuelve a pedir la bandeja.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargar = useCallback(() => api.bandeja(), [api, version]);
  const { datos, error, cargando, recargar } = useCarga(cargar, conectado === true);
  // Se eligen lotes enteros: aprobar uno por uno se hace en el detalle (RF-403).
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [aprobando, setAprobando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const aprobar = async () => {
    const ids = (datos?.lotes ?? []).filter((l) => seleccionados.includes(l.loteId)).flatMap((l) => l.justificaciones.map((j) => j.id));
    if (!ids.length) return;
    setAprobando(true);
    setAviso(null);
    try {
      await api.revisar(ids, "aprobada");
      setSeleccionados([]);
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

  const lotes = datos?.lotes ?? [];
  const alternar = (loteId: string) =>
    setSeleccionados((actuales) => (actuales.includes(loteId) ? actuales.filter((id) => id !== loteId) : [...actuales, loteId]));

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.cabecera}>
        <View style={estilos.flex}>
          <Text style={tipografia.titulo}>Pendientes</Text>
          {datos ? <Text style={[tipografia.nota, estilos.suave]}>{lotes.length === 1 ? "1 lote por revisar" : `${lotes.length} lotes por revisar`}</Text> : null}
        </View>
        {puedeRevisar ? <Boton etiqueta="Plazo para justificar" variante="enlace" alPresionar={() => router.push("/coordinacion/justificaciones/plazo")} /> : null}
      </View>
      {cargando ? <Text style={[tipografia.cuerpo, estilos.suave]}>Cargando la bandeja…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {datos && !lotes.length ? (
        <Tarjeta>
          <Text style={[tipografia.cuerpo, estilos.suave]}>No hay justificaciones pendientes.</Text>
        </Tarjeta>
      ) : null}
      {lotes.map((lote) => {
        const ninos = unirNombres(lote.justificaciones.map((j) => j.nombre));
        const marcado = seleccionados.includes(lote.loteId);
        const abrir = () => router.push({ pathname: "/coordinacion/justificaciones/[loteId]", params: { loteId: lote.loteId } });
        return (
          <Tarjeta key={lote.loteId} seleccionada={marcado}>
            <View style={estilos.cabecera}>
              {puedeRevisar ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                  accessibilityLabel={`Elegir el lote de ${ninos}`}
                  hitSlop={espacio.s}
                  onPress={() => alternar(lote.loteId)}
                  style={[estilos.casilla, marcado ? estilos.casillaMarcada : null]}
                >
                  {marcado ? <Text style={estilos.check}>✓</Text> : null}
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Revisar el lote de ${ninos}`} onPress={abrir} style={estilos.flex}>
                <Text style={tipografia.cuerpoFuerte}>{ninos}</Text>
                <Text style={[tipografia.nota, estilos.suave]}>
                  {`${ETIQUETAS_CAUSA[lote.causa]} · ${lote.justificaciones.length === 1 ? "1 ausencia" : `${lote.justificaciones.length} ausencias`}`}
                </Text>
              </Pressable>
              <Text style={[tipografia.nota, estilos.suave]}>{etiquetaFechaCorta(lote.enviadaEn)}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={abrir} style={estilos.detalle}>
              {agruparPorNinoYFecha(lote.justificaciones).map((grupo) => (
                <Text key={grupo[0].id} style={tipografia.cuerpo}>{`${grupo[0].nombre} · ${etiquetaFecha(grupo[0].fecha)} · ${etiquetaSesiones(grupo)}`}</Text>
              ))}
              <View style={estilos.insignias}>
                {lote.justificaciones.some((j) => j.duplicada) ? <Insignia texto="Otra justificación para la misma ausencia" tono="advertencia" /> : null}
                {lote.canal === "coordinacion" ? <Insignia texto="Registrada por la coordinación" tono="neutro" /> : null}
              </View>
              <Text style={[tipografia.etiqueta, estilos.enlace]}>Ver evidencia y revisar ›</Text>
            </Pressable>
          </Tarjeta>
        );
      })}
      {aviso ? <Aviso tono="error" mensaje={aviso} /> : null}
      {puedeRevisar ? (
        <View style={estilos.acciones}>
          <Boton etiqueta="Registrar en nombre de un apoderado" variante="secundario" alPresionar={() => router.push("/coordinacion/justificaciones/registrar")} />
          {lotes.length ? (
            <Boton etiqueta={`Aprobar seleccionadas (${seleccionados.length})`} alPresionar={() => void aprobar()} cargando={aprobando} deshabilitado={!seleccionados.length} />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  acciones: { gap: espacio.s, marginTop: espacio.s },
  cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  flex: { flex: 1 },
  detalle: { gap: espacio.xs, marginTop: espacio.s },
  insignias: { flexDirection: "row", flexWrap: "wrap", gap: espacio.xs },
  enlace: { color: colores.primario, marginTop: espacio.xs },
  suave: { color: colores.textoSuave },
  casilla: {
    width: espacio.xl,
    height: espacio.xl,
    borderRadius: radio.campo / 2,
    borderWidth: 2,
    borderColor: colores.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: colores.primario, borderColor: colores.primario },
  check: { color: colores.primarioTexto, ...tipografia.etiqueta },
});
