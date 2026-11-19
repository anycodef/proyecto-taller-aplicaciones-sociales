import { StyleSheet, Text, View } from "react-native";

import { Aviso, Tarjeta } from "@/components/ui";
import { tipoDeRespuesta, type RespuestaAsistenteApi } from "@/lib/asistente/api";
import { colores, espacio, radio, tipografia } from "@/tema";

export type MensajeChat =
  | { id: string; autor: "usuario"; texto: string }
  | { id: string; autor: "asistente"; respuesta: RespuestaAsistenteApi }
  | { id: string; autor: "error"; texto: string };

export interface PropiedadesBurbujaMensaje {
  mensaje: MensajeChat;
}

/**
 * Una burbuja del chat. La respuesta con fuentes se muestra como doctrina citada; la abstención y el rechazo
 * van en un aviso informativo para que nadie los tome por una respuesta doctrinal (RF-1003, RF-1004).
 */
export function BurbujaMensaje({ mensaje }: PropiedadesBurbujaMensaje) {
  if (mensaje.autor === "usuario") {
    return (
      <View style={[estilos.burbuja, estilos.usuario]}>
        <Text style={[tipografia.cuerpo, estilos.textoUsuario]}>{mensaje.texto}</Text>
      </View>
    );
  }
  if (mensaje.autor === "error") return <Aviso tono="error" mensaje={mensaje.texto} />;

  const { respuesta } = mensaje;
  const tipo = tipoDeRespuesta(respuesta);
  if (tipo !== "citada") return <Aviso tono="informativo" mensaje={respuesta.respuesta} />;

  return (
    <Tarjeta>
      <Text style={[tipografia.cuerpo, estilos.texto]}>{respuesta.respuesta}</Text>
      <View style={estilos.fuentes}>
        {respuesta.fuentes.map((fuente) => (
          <View key={fuente.id} style={estilos.fuente}>
            <Text style={[tipografia.etiqueta, estilos.texto]}>
              {fuente.documento} · {fuente.seccion}
            </Text>
            <Text style={[tipografia.nota, estilos.tenue]}>{fuente.licencia}</Text>
          </View>
        ))}
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  burbuja: { maxWidth: "85%", padding: espacio.m, borderRadius: radio.tarjeta },
  usuario: { alignSelf: "flex-end", backgroundColor: colores.primario },
  textoUsuario: { color: colores.primarioTexto },
  texto: { color: colores.texto },
  tenue: { color: colores.textoTenue },
  fuentes: { gap: espacio.s },
  fuente: { gap: espacio.xs },
});
