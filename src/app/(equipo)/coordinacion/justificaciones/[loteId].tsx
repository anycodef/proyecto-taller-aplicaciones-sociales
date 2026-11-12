import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { VisorEvidencia } from "@/components/justificaciones/visor-evidencia";
import { Aviso, Boton, CampoTexto, Insignia, Tarjeta } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import type { LecturaEvidencia } from "@/lib/justificaciones/cliente-justificaciones";
import { MOTIVO_RECHAZO_MAXIMO } from "@/lib/justificaciones/estados";
import { alternarSeleccion, etiquetaSesion, fechaCorta } from "@/lib/justificaciones/seleccion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api-justificaciones";
import { alturaMinimaToque, colores, espacio, tipografia } from "@/tema";

type Fase = { tipo: "ver" } | { tipo: "rechazando" } | { tipo: "guardando" };

/** Detalle de un lote: ver la evidencia, aprobar todo o una selección, o rechazar con motivo obligatorio (RF-406). */
export default function DetalleLote() {
  const { loteId } = useLocalSearchParams<{ loteId: string }>();
  const api = useApiJustificaciones();
  const { datos, error, cargando, recargar } = useCarga(api.bandeja);
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [fase, setFase] = useState<Fase>({ tipo: "ver" });
  const [motivo, setMotivo] = useState("");
  const [evidencia, setEvidencia] = useState<LecturaEvidencia | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const lote = datos?.find((l) => l.loteId === loteId);
  const objetivo = lote ? (seleccion.size > 0 ? lote.justificaciones.filter((j) => seleccion.has(j.id)) : lote.justificaciones) : [];
  const ids = objetivo.map((j) => j.id);
  const motivoLimpio = motivo.trim();

  async function verEvidencia() {
    if (!lote) return;
    setAviso(null);
    try {
      setEvidencia(await api.evidencia(lote.justificaciones[0].id));
    } catch {
      setAviso("No pudimos abrir la evidencia. Puede que ya no esté disponible.");
    }
  }

  async function decidir(decision: "aprobada" | "rechazada") {
    if (ids.length === 0) return;
    setFase({ tipo: "guardando" });
    setAviso(null);
    try {
      await api.revisar(ids, decision, decision === "rechazada" ? motivoLimpio : undefined);
      // Si quedaban justificaciones sin revisar, se vuelve a cargar el lote; si no, regresa a la bandeja.
      if (lote && ids.length < lote.justificaciones.length) {
        setSeleccion(new Set());
        setMotivo("");
        setFase({ tipo: "ver" });
        recargar();
      } else {
        router.back();
      }
    } catch (fallo) {
      const codigo = fallo && typeof fallo === "object" && "codigo" in fallo ? String((fallo as { codigo: unknown }).codigo) : "";
      setAviso(codigo === "no_pendiente" ? "Otra persona ya revisó esta justificación. Actualizando la bandeja." : "No se pudo guardar la decisión. Revisa tu conexión e inténtalo de nuevo.");
      setFase({ tipo: "ver" });
      if (codigo === "no_pendiente") recargar();
    }
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Aviso tono="error" mensaje={error} />
        <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} />
      </ScrollView>
    );
  }
  if (cargando && !datos) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.suave]}>Cargando…</Text>
      </ScrollView>
    );
  }
  if (!lote) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Aviso tono="informativo" mensaje="Este lote ya fue revisado." />
        <Boton etiqueta="Volver a la bandeja" alPresionar={() => router.back()} />
      </ScrollView>
    );
  }

  const guardando = fase.tipo === "guardando";
  const todo = seleccion.size === 0;

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Lote de justificaciones</Text>
      <Text style={[tipografia.cuerpo, estilos.suave]}>{ETIQUETAS_CAUSA[lote.justificaciones[0].causa]}</Text>

      <View style={estilos.lista}>
        {lote.justificaciones.map((j) => {
          const marcada = seleccion.has(j.id);
          return (
            <Pressable key={j.id} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }} onPress={() => setSeleccion((actual) => alternarSeleccion(actual, j.id))}>
              <Tarjeta seleccionada={marcada}>
                <View style={estilos.fila}>
                  <View style={estilos.textos}>
                    <Text style={[tipografia.cuerpoFuerte, estilos.titulo]}>{j.nombre}</Text>
                    <Text style={[tipografia.nota, estilos.suave]}>
                      {etiquetaSesion(j.tipoSesion)} · {fechaCorta(j.fecha)}
                    </Text>
                  </View>
                  {j.duplicada ? <Insignia texto="Posible duplicada" tono="advertencia" /> : null}
                </View>
              </Tarjeta>
            </Pressable>
          );
        })}
      </View>

      {evidencia ? <VisorEvidencia urls={evidencia.urls} expiraEn={evidencia.expiraEn} /> : <Boton etiqueta="Ver evidencia" variante="secundario" alPresionar={() => void verEvidencia()} />}
      {aviso ? <Aviso tono="advertencia" mensaje={aviso} /> : null}

      {fase.tipo === "rechazando" ? (
        <Tarjeta tono="advertencia">
          <Text style={[tipografia.cuerpoFuerte, estilos.titulo]}>Rechazar {ids.length === 1 ? "la justificación" : `${ids.length} justificaciones`}</Text>
          <CampoTexto etiqueta="Motivo (la familia lo verá)" valor={motivo} alCambiar={setMotivo} maximoCaracteres={MOTIVO_RECHAZO_MAXIMO} marcador="Por ejemplo: la foto no se lee" />
          <Boton etiqueta="Confirmar rechazo" deshabilitado={motivoLimpio.length === 0 || guardando} cargando={guardando} alPresionar={() => void decidir("rechazada")} />
          <Boton etiqueta="Cancelar" variante="enlace" deshabilitado={guardando} alPresionar={() => setFase({ tipo: "ver" })} />
        </Tarjeta>
      ) : (
        <View style={estilos.acciones}>
          <Boton etiqueta={todo ? "Aprobar todo el lote" : `Aprobar ${seleccion.size} seleccionada${seleccion.size === 1 ? "" : "s"}`} cargando={guardando} deshabilitado={guardando} alPresionar={() => void decidir("aprobada")} />
          <Boton etiqueta={todo ? "Rechazar todo el lote" : `Rechazar ${seleccion.size} seleccionada${seleccion.size === 1 ? "" : "s"}`} variante="secundario" deshabilitado={guardando} alPresionar={() => setFase({ tipo: "rechazando" })} />
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  lista: { gap: espacio.m },
  fila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.m, minHeight: alturaMinimaToque },
  textos: { flex: 1 },
  acciones: { gap: espacio.m },
});
