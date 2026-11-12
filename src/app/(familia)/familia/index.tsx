import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta, type TonoInsignia } from "@/components/ui";
import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { agruparPorDomingo } from "@/lib/justificaciones/justificables";
import {
  agruparPorNinoYFecha,
  AVISO_SIN_CONEXION,
  diasRestantes,
  ETIQUETAS_ESTADO,
  ETIQUETAS_ORIGEN,
  etiquetaDiasRestantes,
  etiquetaFecha,
  nombresSesiones,
} from "@/lib/justificaciones/presentacion";
import type { EstadoVisible } from "@/lib/justificaciones/tipos";
import { hoyEnLima } from "@/lib/seguridad/fechas";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const TONO_ESTADO: Record<EstadoVisible, TonoInsignia> = { pendiente: "advertencia", aprobada: "solido", rechazada: "error", sin_efecto: "neutro" };
/** Con tres días o menos el plazo se resalta para que no se pase. */
const DIAS_AVISO = 3;

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
  // Una tarjeta por niño, fecha y resultado: misa y catequesis del mismo domingo no se repiten.
  const enviadas = useMemo(
    () => agruparPorNinoYFecha(datos?.enviadas ?? [], (j) => `${j.estado}|${j.motivoRechazo ?? ""}|${j.origen}`),
    [datos],
  );
  const hoy = hoyEnLima();

  if (conectado === false) {
    return (
      <View style={estilos.contenido}>
        <Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.seccion}>
        <Text style={tipografia.titulo}>Ausencias por justificar</Text>
        <Text style={[tipografia.nota, estilos.suave]}>Toca una ausencia para enviar el comprobante.</Text>
      </View>
      {cargando ? <Text style={[tipografia.cuerpo, estilos.suave]}>Buscando ausencias…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {datos && !filas.length ? (
        <Tarjeta>
          <Text style={[tipografia.cuerpo, estilos.suave]}>No hay ausencias por justificar.</Text>
        </Tarjeta>
      ) : null}
      <View style={estilos.lista}>
        {filas.map((fila) => {
          const vence = datos?.justificables.ausencias.find((a) => a.sesionId === fila.ausencias[0].sesionId)?.venceEn;
          const dias = vence ? diasRestantes(vence, hoy) : null;
          const titulo = `${nombres.get(fila.catequizandoId) ?? "Su hijo"} · ${etiquetaFecha(fila.fecha)}`;
          return (
            <Pressable
              key={`${fila.catequizandoId}|${fila.fecha}|${fila.ausencias[0].sesionId}`}
              accessibilityRole="button"
              accessibilityLabel={`Justificar ${titulo}`}
              onPress={() =>
                router.push({ pathname: "/familia/justificar", params: { marcar: fila.ausencias.map((a) => `${a.catequizandoId}|${a.sesionId}`).join(",") } })
              }
            >
              <Tarjeta>
                <View style={estilos.cabecera}>
                  <Text style={[tipografia.cuerpoFuerte, estilos.flex]}>{titulo}</Text>
                  <Text style={[tipografia.encabezado, estilos.suave]}>›</Text>
                </View>
                <View style={estilos.etiquetas}>
                  {nombresSesiones(fila.ausencias).map((sesion) => <Insignia key={sesion} texto={sesion} tono="neutro" />)}
                </View>
                {dias !== null ? (
                  <Text style={[tipografia.nota, dias <= DIAS_AVISO ? estilos.urgente : estilos.suave]}>
                    {`${etiquetaDiasRestantes(dias)} · hasta el ${etiquetaFecha(vence!)}`}
                  </Text>
                ) : null}
              </Tarjeta>
            </Pressable>
          );
        })}
      </View>
      <Boton etiqueta="Avisar un evento escolar" variante="secundario" alPresionar={() => router.push("/familia/anticipar")} />

      <View style={[estilos.seccion, estilos.separada]}>
        <Text style={tipografia.encabezado}>Mis justificaciones</Text>
        <Text style={[tipografia.nota, estilos.suave]}>Aquí ves si la coordinación las aceptó.</Text>
      </View>
      {datos && !enviadas.length ? <Text style={[tipografia.cuerpo, estilos.suave]}>Aún no envió justificaciones.</Text> : null}
      <View style={estilos.lista}>
        {enviadas.map((grupo) => {
          const j = grupo[0];
          return (
            <Tarjeta key={grupo.map((x) => x.id).join(",")}>
              <View style={estilos.cabecera}>
                <Text style={[tipografia.cuerpoFuerte, estilos.flex]}>{`${nombres.get(j.catequizandoId) ?? "Su hijo"} · ${etiquetaFecha(j.fecha)}`}</Text>
                <Insignia texto={ETIQUETAS_ESTADO[j.estado]} tono={TONO_ESTADO[j.estado]} />
              </View>
              <View style={estilos.etiquetas}>
                {nombresSesiones(grupo).map((sesion) => <Insignia key={sesion} texto={sesion} tono="neutro" />)}
              </View>
              <Text style={[tipografia.nota, estilos.suave]}>{ETIQUETAS_ORIGEN[j.origen]}</Text>
              {j.estado === "rechazada" && j.motivoRechazo ? <Text style={[tipografia.nota, estilos.error]}>{`Motivo: ${j.motivoRechazo}`}</Text> : null}
            </Tarjeta>
          );
        })}
      </View>
      {error ? <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  seccion: { gap: espacio.xs },
  separada: { marginTop: espacio.l },
  lista: { gap: espacio.s },
  suave: { color: colores.textoSuave },
  urgente: { color: colores.advertenciaTexto },
  error: { color: colores.errorTexto },
  cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: espacio.xs },
  flex: { flex: 1 },
});
