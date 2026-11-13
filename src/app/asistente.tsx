import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { BurbujaMensaje, type MensajeChat } from "@/components/asistente/burbuja-mensaje";
import { Aviso, Boton, CampoTexto } from "@/components/ui";
import {
  AVISO_PRIVACIDAD_ASISTENTE,
  crearApiAsistente,
  NOTA_ASISTENTE,
  PREGUNTA_MAXIMO,
  preguntaValida,
  SUGERENCIAS,
} from "@/lib/asistente/api";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

function mensajeDeError(error: unknown): string {
  const estado = error && typeof error === "object" && "estado" in error ? Number((error as { estado: unknown }).estado) : undefined;
  if (estado === 429) return "Llegaste al límite de preguntas por hora; intenta más tarde.";
  if (estado === 401) return "Tu sesión ya no sirve. Vuelve a abrir tu enlace.";
  return "No pudimos consultar el servidor";
}

/**
 * Chat de catequesis para cualquier rol autenticado. El historial vive solo en la memoria de esta pantalla:
 * ni el servidor ni el celular guardan preguntas ni respuestas (RNF-1001, RNF-1004).
 */
export default function Asistente() {
  const { cliente } = useSesion();
  const api = useMemo(() => crearApiAsistente(cliente), [cliente]);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [consultando, setConsultando] = useState(false);
  const conectado = useConexion();
  const sinConexion = conectado === false;
  const contador = useRef(0);

  async function preguntar(pregunta: string) {
    if (!preguntaValida(pregunta) || consultando || sinConexion) return;
    const limpia = pregunta.trim();
    const id = () => `m-${++contador.current}`;
    setMensajes((actuales) => [...actuales, { id: id(), autor: "usuario", texto: limpia }]);
    setTexto("");
    setConsultando(true);
    try {
      const respuesta = await api.preguntar(limpia);
      setMensajes((actuales) => [...actuales, { id: id(), autor: "asistente", respuesta }]);
    } catch (fallo) {
      // No se pierde la pregunta: vuelve al campo para reenviarla.
      setTexto(limpia);
      setMensajes((actuales) => [...actuales, { id: id(), autor: "error", texto: mensajeDeError(fallo) }]);
    } finally {
      setConsultando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Text style={[tipografia.titulo, estilos.titulo]}>Asistente de catequesis</Text>
      <Aviso tono="informativo" mensaje={NOTA_ASISTENTE} />
      <Aviso tono="advertencia" mensaje={AVISO_PRIVACIDAD_ASISTENTE} />
      {sinConexion ? (
        <Aviso
          tono="advertencia"
          mensaje="El asistente necesita conexión. La asistencia y las justificaciones siguen funcionando sin conexión."
        />
      ) : null}

      {mensajes.length === 0 ? (
        <View style={estilos.sugerencias}>
          <Text style={[tipografia.etiqueta, estilos.suave]}>Prueba con una de estas preguntas</Text>
          {SUGERENCIAS.map((sugerencia) => (
            <Boton
              key={sugerencia}
              etiqueta={sugerencia}
              variante="secundario"
              deshabilitado={consultando || sinConexion}
              alPresionar={() => void preguntar(sugerencia)}
            />
          ))}
        </View>
      ) : null}

      <View style={estilos.chat}>
        {mensajes.map((mensaje) => (
          <BurbujaMensaje key={mensaje.id} mensaje={mensaje} />
        ))}
        {consultando ? <Text style={[tipografia.nota, estilos.suave]}>Buscando en el material público…</Text> : null}
      </View>

      <CampoTexto etiqueta="Tu pregunta" valor={texto} alCambiar={setTexto} maximoCaracteres={PREGUNTA_MAXIMO} marcador="Escribe tu pregunta de catequesis" />
      <Boton
        etiqueta={consultando ? "Consultando…" : "Preguntar"}
        cargando={consultando}
        deshabilitado={!preguntaValida(texto) || consultando || sinConexion}
        alPresionar={() => void preguntar(texto)}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  sugerencias: { gap: espacio.s },
  chat: { gap: espacio.m },
});
