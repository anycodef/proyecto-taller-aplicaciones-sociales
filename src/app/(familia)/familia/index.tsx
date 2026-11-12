import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, FilaNavegacion, Insignia, Tarjeta, type TonoInsignia } from "@/components/ui";
import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { agruparPorDomingo } from "@/lib/justificaciones/justificables";
import { AVISO_SIN_CONEXION, ETIQUETAS_ESTADO, ETIQUETAS_ORIGEN, etiquetaFecha, etiquetaSesiones } from "@/lib/justificaciones/presentacion";
import type { EstadoVisible } from "@/lib/justificaciones/tipos";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const TONO_ESTADO: Record<EstadoVisible, TonoInsignia> = { pendiente: "advertencia", aprobada: "solido", rechazada: "error", sin_efecto: "neutro" };

/** Primero lo que falta justificar; debajo, el estado de lo ya enviado (RF-401, RF-410). */
export default function InicioFamilia() {
  const { cliente } = useSesion();
  const api = useMemo(() => crearClienteJustificaciones(cliente), [cliente]);
  const conectado = useConexion();
  const cargar = useCallback(async () => {
    const [justificables, enviadas] = await Promise.all([api.ausenciasJustificables(), api.misJustificaciones()]);
    return { justificables, enviadas };
  }, [api]);
  const { datos, error, cargando, recargar } = useCarga(cargar, conectado === true);
  const nombres = useMemo(() => new Map((datos?.justificables.ninos ?? []).map((n) => [n.catequizandoId, n.nombres])), [datos]);
  const filas = useMemo(() => agruparPorDomingo(datos?.justificables.ausencias ?? []), [datos]);

  if (conectado === false) {
    return (
      <View style={estilos.contenido}>
        <Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={tipografia.titulo}>Ausencias por justificar</Text>
      {cargando ? <Text style={[tipografia.cuerpo, estilos.suave]}>Buscando ausencias…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {datos && !filas.length ? <Text style={[tipografia.cuerpo, estilos.suave]}>No hay ausencias por justificar.</Text> : null}
      <View style={estilos.lista}>
        {filas.map((fila) => {
          const vence = datos?.justificables.ausencias.find((a) => a.sesionId === fila.ausencias[0].sesionId)?.venceEn;
          return (
            <FilaNavegacion
              key={`${fila.catequizandoId}|${fila.fecha}|${fila.ausencias[0].sesionId}`}
              titulo={`${nombres.get(fila.catequizandoId) ?? "Su hijo"} · ${etiquetaFecha(fila.fecha)}`}
              subtitulo={`${etiquetaSesiones(fila.ausencias)}${vence ? ` · hasta el ${etiquetaFecha(vence)}` : ""}`}
              alPresionar={() =>
                router.push({ pathname: "/familia/justificar", params: { marcar: fila.ausencias.map((a) => `${a.catequizandoId}|${a.sesionId}`).join(",") } })
              }
            />
          );
        })}
      </View>
      <Boton etiqueta="Avisar un evento escolar" variante="secundario" alPresionar={() => router.push("/familia/anticipar")} />

      <Text style={[tipografia.encabezado, estilos.seccion]}>Mis justificaciones</Text>
      {datos && !datos.enviadas.length ? <Text style={[tipografia.cuerpo, estilos.suave]}>Aún no envió justificaciones.</Text> : null}
      <View style={estilos.lista}>
        {datos?.enviadas.map((j) => (
          <Tarjeta key={j.id}>
            <View style={estilos.cabecera}>
              <Text style={[tipografia.cuerpoFuerte, estilos.flex]}>{`${nombres.get(j.catequizandoId) ?? "Su hijo"} · ${etiquetaFecha(j.fecha)}`}</Text>
              <Insignia texto={ETIQUETAS_ESTADO[j.estado]} tono={TONO_ESTADO[j.estado]} />
            </View>
            <Text style={[tipografia.nota, estilos.suave]}>{`${etiquetaSesiones([j])} · ${ETIQUETAS_ORIGEN[j.origen]}`}</Text>
            {j.estado === "rechazada" && j.motivoRechazo ? <Text style={[tipografia.nota, estilos.error]}>{`Motivo: ${j.motivoRechazo}`}</Text> : null}
          </Tarjeta>
        ))}
      </View>
      {error ? <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  lista: { gap: espacio.s },
  seccion: { marginTop: espacio.l, color: colores.texto },
  suave: { color: colores.textoSuave },
  error: { color: colores.errorTexto },
  cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  flex: { flex: 1 },
});
