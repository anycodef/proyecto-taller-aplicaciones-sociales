import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton, CampoTexto, FilaNavegacion, Insignia } from "@/components/ui";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

function fechaCorta(instante: string): string {
  return instante ? instante.slice(0, 10) : "";
}

export default function Auditoria() {
  const { api } = useSesion();
  const [catequizandoId, setCatequizandoId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [consulta, setConsulta] = useState<{ catequizandoId?: string; desde?: string; hasta?: string }>({});

  const cargar = useCallback(
    () => api.consultarAuditoria(consulta),
    [api, consulta]
  );
  const { datos, error, cargando } = useCarga(cargar);

  const consultar = () => {
    setConsulta({
      ...(catequizandoId.trim() ? { catequizandoId: catequizandoId.trim() } : {}),
      ...(desde.trim() ? { desde: desde.trim() } : {}),
      ...(hasta.trim() ? { hasta: hasta.trim() } : {}),
    });
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Auditoría</Text>

      <CampoTexto
        etiqueta="Id del niño"
        marcador="Identificador del catequizando"
        valor={catequizandoId}
        alCambiar={setCatequizandoId}
      />
      <CampoTexto etiqueta="Desde (ISO)" valor={desde} alCambiar={setDesde} />
      <CampoTexto etiqueta="Hasta (ISO)" valor={hasta} alCambiar={setHasta} />

      <Boton etiqueta="Consultar" alPresionar={consultar} />

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}
      {cargando ? <Text style={[tipografia.cuerpo, estilos.texto]}>Consultando…</Text> : null}

      <View style={estilos.lista}>
        {datos?.map((evento) => (
          <FilaNavegacion
            key={evento.id}
            titulo={`${evento.autorVisible ?? "Sistema"} · ${evento.accion}`}
            subtitulo={`${fechaCorta(evento.ocurridoEn)}${evento.recursoTipo ? ` · ${evento.recursoTipo}` : ""}`}
            derecha={
              <Insignia
                texto={evento.resultado === "permitido" ? "Permitido" : "Denegado"}
                tono={evento.resultado === "permitido" ? "suave" : "error"}
              />
            }
          />
        ))}
      </View>

      {datos?.length === 0 && !cargando ? (
        <Text style={[tipografia.cuerpo, estilos.texto]}>No hay eventos para esa consulta.</Text>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  error: { color: colores.errorTexto },
  lista: { gap: espacio.s },
});
