import { randomUUID } from "expo-crypto";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SelectorAusencias } from "@/components/justificaciones/selector-ausencias";
import { SelectorCausa } from "@/components/justificaciones/selector-causa";
import { Aviso, Boton, Tarjeta } from "@/components/ui";
import { enviarJustificacion, type FotoComprimida } from "@/lib/justificaciones/enviar-justificacion";
import { alternarSeleccion, puedeEnviar, seleccionadas } from "@/lib/justificaciones/seleccion";
import type { Causa } from "@/lib/justificaciones/tipos";
import { useCarga } from "@/plataforma/api/usar-carga";
import { comprimirFoto } from "@/plataforma/justificaciones/comprimir-foto";
import { elegirFoto, type OrigenFoto } from "@/plataforma/justificaciones/elegir-foto";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api-justificaciones";
import { colores, espacio, tipografia } from "@/tema";

type Fase = { tipo: "formulario" } | { tipo: "reduciendo" } | { tipo: "enviando" } | { tipo: "fallo"; mensaje: string };

/**
 * Justificar una o varias ausencias en menos de un minuto (RNF-401): ausencias, motivo, foto y Enviar.
 * Si algo falla muestra "No se envió" y no guarda ni la foto ni una cola para después (RNF-404).
 */
export default function Justificar() {
  const api = useApiJustificaciones();
  const { datos: ausencias, error, cargando, recargar } = useCarga(api.ausenciasJustificables);
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [causa, setCausa] = useState<Causa | null>(null);
  const [foto, setFoto] = useState<FotoComprimida | null>(null);
  const [fase, setFase] = useState<Fase>({ tipo: "formulario" });
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null);

  const elegidas = ausencias ? seleccionadas(ausencias, seleccion) : [];
  const ocupada = fase.tipo === "reduciendo" || fase.tipo === "enviando";
  const habilitado = puedeEnviar({ cantidadAusencias: elegidas.length, tieneCausa: causa !== null, tieneFoto: foto !== null });

  async function tomarFoto(origen: OrigenFoto) {
    setAvisoFoto(null);
    try {
      const eleccion = await elegirFoto(origen);
      if ("denegado" in eleccion) return setAvisoFoto("Necesitamos permiso de la cámara. También puedes elegir una foto de tu galería.");
      if ("cancelada" in eleccion) return;
      setFase({ tipo: "reduciendo" });
      setFoto(await comprimirFoto(eleccion.uri));
    } catch {
      setFoto(null);
      setAvisoFoto("No pudimos preparar esa foto. Prueba con otra.");
    } finally {
      setFase({ tipo: "formulario" });
    }
  }

  async function enviar() {
    if (!habilitado || !causa || !foto) return;
    setFase({ tipo: "enviando" });
    try {
      const lote = await enviarJustificacion(
        { cliente: api, generarId: randomUUID },
        { causa, fotos: [foto], ausencias: elegidas.map((a) => ({ catequizandoId: a.catequizandoId, sesionId: a.sesionId })) },
      );
      setFoto(null);
      router.replace(`/familia/enviada?cantidad=${lote.justificaciones.length}` as Href);
    } catch (fallo) {
      setFase({ tipo: "fallo", mensaje: fallo instanceof Error && "mensaje" in fallo ? String((fallo as { mensaje: unknown }).mensaje) : "No se envió. Inténtalo de nuevo." });
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Justificar una ausencia</Text>
      <Text style={[tipografia.cuerpo, estilos.suave]}>Elige las ausencias, el motivo y adjunta una foto del comprobante.</Text>

      {cargando ? <Text style={[tipografia.cuerpo, estilos.suave]}>Buscando ausencias…</Text> : null}
      {error ? (
        <View style={estilos.bloque}>
          <Aviso tono="error" mensaje={error} />
          <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} />
        </View>
      ) : null}

      {ausencias && ausencias.length === 0 ? (
        <Aviso tono="informativo" mensaje="No tienes ausencias por justificar. Las que ya pasó el plazo no se pueden enviar." />
      ) : null}

      {ausencias && ausencias.length > 0 ? (
        <>
          <SelectorAusencias ausencias={ausencias} seleccion={seleccion} alAlternar={(clave) => setSeleccion((actual) => alternarSeleccion(actual, clave))} />
          <SelectorCausa valor={causa} alCambiar={setCausa} />

          <Tarjeta tono={foto ? "primaria" : "neutra"}>
            <Text style={[tipografia.cuerpoFuerte, estilos.titulo]}>Foto del comprobante</Text>
            <Text style={[tipografia.nota, estilos.suave]}>
              {foto ? `Foto lista (${Math.max(1, Math.round(foto.bytes / 1024))} KB). Se envía y no se guarda en el celular.` : "Una foto clara del comprobante, hasta 300 KB después de reducirla."}
            </Text>
            <Boton etiqueta={fase.tipo === "reduciendo" ? "Reduciendo foto…" : foto ? "Cambiar foto" : "Tomar foto"} cargando={fase.tipo === "reduciendo"} deshabilitado={ocupada} variante={foto ? "secundario" : "primario"} alPresionar={() => void tomarFoto("camara")} />
            <Boton etiqueta="Elegir de la galería" variante="enlace" deshabilitado={ocupada} alPresionar={() => void tomarFoto("galeria")} />
            {avisoFoto ? <Aviso tono="advertencia" mensaje={avisoFoto} /> : null}
          </Tarjeta>

          {fase.tipo === "fallo" ? (
            <Aviso tono="error" mensaje={fase.mensaje} />
          ) : null}
          <Boton
            etiqueta={fase.tipo === "enviando" ? "Enviando…" : fase.tipo === "fallo" ? "Reintentar envío" : `Enviar ${elegidas.length > 1 ? `${elegidas.length} justificaciones` : "justificación"}`}
            cargando={fase.tipo === "enviando"}
            deshabilitado={!habilitado || ocupada}
            alPresionar={() => void enviar()}
          />
        </>
      ) : null}

      <Boton etiqueta="Mis justificaciones" variante="enlace" alPresionar={() => router.push("/familia/mis-justificaciones" as Href)} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  bloque: { gap: espacio.m },
});
