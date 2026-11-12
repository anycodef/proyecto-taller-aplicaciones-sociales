import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { claveDeFila, FormularioJustificacion } from "@/components/justificaciones/formulario-justificacion";
import { Aviso } from "@/components/ui";
import { CAUSAS } from "@/lib/justificaciones/causas";
import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { agruparPorDomingo } from "@/lib/justificaciones/justificables";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export default function Justificar() {
  const { marcar } = useLocalSearchParams<{ marcar?: string }>();
  const { cliente } = useSesion();
  const api = useMemo(() => crearClienteJustificaciones(cliente), [cliente]);
  const cargar = useCallback(() => api.ausenciasJustificables(), [api]);
  const { datos, error, cargando } = useCarga(cargar);
  const filas = useMemo(() => agruparPorDomingo(datos?.ausencias ?? []), [datos]);
  const nombres = useMemo(() => new Map((datos?.ninos ?? []).map((n) => [n.catequizandoId, n.nombres])), [datos]);
  const pedidas = (marcar ?? "").split(",").filter(Boolean);
  const marcadas = filas.filter((f) => f.ausencias.some((a) => pedidas.includes(`${a.catequizandoId}|${a.sesionId}`))).map(claveDeFila);

  if (cargando) return <Text style={[tipografia.cuerpo, estilos.contenido]}>Cargando…</Text>;
  if (error) return <View style={estilos.contenido}><Aviso tono="error" mensaje={error} /></View>;
  return (
    <FormularioJustificacion
      titulo="Justificar ausencia"
      filas={filas}
      nombres={nombres}
      marcadasAlInicio={marcadas}
      causas={CAUSAS}
      anticipada={false}
      textoFoto="Foto del certificado o comprobante"
    />
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
});
