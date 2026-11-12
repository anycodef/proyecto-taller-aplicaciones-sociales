import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta, type TonoInsignia } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import type { EstadoVisible } from "@/lib/justificaciones/tipos";
import { etiquetaSesion, fechaCorta } from "@/lib/justificaciones/seleccion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api-justificaciones";
import { colores, espacio, tipografia } from "@/tema";

const ESTADOS: Record<EstadoVisible, { texto: string; tono: TonoInsignia }> = {
  pendiente: { texto: "En revisión", tono: "advertencia" },
  aprobada: { texto: "Aprobada", tono: "solido" },
  rechazada: { texto: "Rechazada", tono: "error" },
  sin_efecto: { texto: "Sin efecto", tono: "neutro" },
};

/** Estado de cada justificación de la familia, con el motivo si fue rechazada (RF-410); nunca la foto. */
export default function MisJustificaciones() {
  const api = useApiJustificaciones();
  const { datos, error, cargando, recargar } = useCarga(api.misJustificaciones);

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Mis justificaciones</Text>
      {cargando ? <Text style={[tipografia.cuerpo, estilos.suave]}>Cargando…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {datos && datos.length === 0 ? <Aviso tono="informativo" mensaje="Todavía no enviaste ninguna justificación." /> : null}

      <View style={estilos.lista}>
        {datos?.map((j) => {
          const estado = ESTADOS[j.estadoVisible];
          return (
            <Tarjeta key={j.id}>
              <View style={estilos.cabecera}>
                <Text style={[tipografia.cuerpoFuerte, estilos.titulo]}>{j.nombre}</Text>
                <Insignia texto={estado.texto} tono={estado.tono} />
              </View>
              <Text style={[tipografia.cuerpo, estilos.suave]}>
                {etiquetaSesion(j.tipoSesion)} · {fechaCorta(j.fecha)}
              </Text>
              <Text style={[tipografia.nota, estilos.suave]}>{ETIQUETAS_CAUSA[j.causa]}</Text>
              {j.origen === "otro_apoderado" ? <Text style={[tipografia.nota, estilos.suave]}>Enviada por otro apoderado</Text> : null}
              {j.origen === "coordinacion" ? <Text style={[tipografia.nota, estilos.suave]}>Registrada por la coordinación</Text> : null}
              {j.estadoVisible === "rechazada" && j.motivoRechazo ? <Aviso tono="error" mensaje={`Motivo: ${j.motivoRechazo}`} /> : null}
            </Tarjeta>
          );
        })}
      </View>

      <Boton etiqueta="Actualizar" variante="secundario" alPresionar={recargar} />
      <Boton etiqueta="Justificar otra ausencia" variante="enlace" alPresionar={() => router.push("/familia/justificar" as Href)} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto, flexShrink: 1 },
  suave: { color: colores.textoSuave },
  lista: { gap: espacio.m },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.m },
});
