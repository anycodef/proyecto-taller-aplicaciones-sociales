import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { FormularioJustificacion } from "@/components/justificaciones/formulario-justificacion";
import { Aviso, GrupoOpciones } from "@/components/ui";
import { CAUSAS } from "@/lib/justificaciones/causas";
import { agruparPorDomingo } from "@/lib/justificaciones/justificables";
import { AVISO_SIN_CONEXION } from "@/lib/justificaciones/presentacion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

/**
 * La justificación que llegó en papel o por WhatsApp se registra aquí en nombre del apoderado (RF-406).
 * Reutiliza el envío de la familia: la foto recibida tampoco queda en el celular (RNF-404).
 */
export default function RegistrarJustificacion() {
  const { apiCatequizandos } = useSesion();
  const api = useApiJustificaciones();
  const conectado = useConexion();
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [ninoId, setNinoId] = useState<string | null>(null);
  const [apoderadoId, setApoderadoId] = useState<string | null>(null);

  const cargarGrupos = useCallback(async () => {
    const ciclo = await apiCatequizandos.cicloAbierto();
    return ciclo ? apiCatequizandos.listarGrupos(ciclo.id) : [];
  }, [apiCatequizandos]);
  const grupos = useCarga(cargarGrupos, conectado === true);
  const cargarNinos = useCallback(() => (grupoId ? apiCatequizandos.listarCarnesGrupo(grupoId) : Promise.resolve([])), [apiCatequizandos, grupoId]);
  const ninos = useCarga(cargarNinos, conectado === true && !!grupoId);
  const cargarAusencias = useCallback(() => (ninoId ? api.justificablesDeNino(ninoId) : Promise.resolve(null)), [api, ninoId]);
  const justificables = useCarga(cargarAusencias, conectado === true && !!ninoId);
  const datos = justificables.datos;
  const filas = useMemo(() => agruparPorDomingo(datos?.ausencias ?? []), [datos]);
  const nombres = useMemo(() => new Map(datos ? [[datos.nino.catequizandoId, datos.nino.nombre]] : []), [datos]);

  if (conectado === false) return <ScrollView contentContainerStyle={estilos.contenido}><Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} /></ScrollView>;

  if (datos && apoderadoId) {
    return (
      <FormularioJustificacion
        titulo={`Registrar en nombre de ${datos.apoderados.find((a) => a.apoderadoId === apoderadoId)?.nombre ?? "el apoderado"}`}
        filas={filas}
        nombres={nombres}
        marcadasAlInicio={[]}
        causas={CAUSAS}
        anticipada={false}
        textoFoto="Foto de la evidencia recibida"
        apoderadoId={apoderadoId}
        rutaEnviada="/coordinacion/justificaciones"
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={tipografia.titulo}>Registrar una justificación</Text>
      {grupos.error ? <Aviso tono="error" mensaje={grupos.error} /> : null}
      <GrupoOpciones etiqueta="Grupo" opciones={(grupos.datos ?? []).map((g) => ({ valor: g.id, etiqueta: g.nombre }))} valor={grupoId} alCambiar={(id) => { setGrupoId(id); setNinoId(null); setApoderadoId(null); }} />
      {grupoId ? (
        <GrupoOpciones etiqueta="Niño o niña" opciones={(ninos.datos ?? []).map((n) => ({ valor: n.catequizandoId, etiqueta: `${n.nombres} ${n.apellidos}` }))} valor={ninoId} alCambiar={(id) => { setNinoId(id); setApoderadoId(null); }} />
      ) : null}
      {justificables.error ? <Aviso tono="error" mensaje={justificables.error} /> : null}
      {datos ? (
        datos.ausencias.length ? (
          <GrupoOpciones etiqueta="Apoderado que la envió" opciones={datos.apoderados.map((a) => ({ valor: a.apoderadoId, etiqueta: a.nombre }))} valor={apoderadoId} alCambiar={setApoderadoId} />
        ) : (
          <Text style={[tipografia.cuerpo, estilos.suave]}>Este niño no tiene ausencias dentro del plazo.</Text>
        )
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  suave: { color: colores.textoSuave },
});
