import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FormularioJustificacion } from "@/components/justificaciones/formulario-justificacion";
import { Aviso } from "@/components/ui";
import { CAUSAS, permiteAnticipada } from "@/lib/justificaciones/causas";
import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { agruparPorDomingo } from "@/lib/justificaciones/justificables";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

/** Aviso anticipado: solo evento escolar, con la foto del comunicado del colegio (RF-404). */
export default function Anticipar() {
  const { cliente } = useSesion();
  const api = useMemo(() => crearClienteJustificaciones(cliente), [cliente]);
  const cargar = useCallback(async () => {
    const [anticipables, justificables] = await Promise.all([api.sesionesAnticipables(), api.ausenciasJustificables()]);
    return { sesiones: anticipables.sesiones, ninos: justificables.ninos };
  }, [api]);
  const { datos, error, cargando } = useCarga(cargar);
  const filas = useMemo(() => agruparPorDomingo(datos?.sesiones ?? []), [datos]);
  const nombres = useMemo(() => new Map((datos?.ninos ?? []).map((n) => [n.catequizandoId, n.nombres])), [datos]);

  if (cargando) return <Text style={[tipografia.cuerpo, estilos.contenido]}>Cargando…</Text>;
  if (error) return <View style={estilos.contenido}><Aviso tono="error" mensaje={error} /></View>;
  return (
    <FormularioJustificacion
      titulo="Avisar un evento escolar"
      filas={filas}
      nombres={nombres}
      marcadasAlInicio={[]}
      causas={CAUSAS.filter(permiteAnticipada)}
      anticipada
      textoFoto="Foto del comunicado del colegio"
    />
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
});
