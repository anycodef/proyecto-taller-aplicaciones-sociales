import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton, IndicadorPasos } from "@/components/ui";
import type { TextoConsentimiento } from "@/lib/seguridad/api";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, radio, tipografia } from "@/tema";

export type PropiedadesConsentimiento = {
  /** Avisa que el apoderado acepto: quien lo llama registra el consentimiento. */
  alAceptar: (texto: TextoConsentimiento) => void;
  /** Texto a mostrar; si no se pasa, se consulta el vigente en el servidor. */
  texto?: TextoConsentimiento | null;
  paso?: number;
  totalPasos?: number;
};

/**
 * Texto vigente del consentimiento, completo, y el boton de aceptacion.
 * El texto se lee en el celular, en linea: nunca se guarda en el dispositivo.
 */
export function ComponenteConsentimiento({
  alAceptar,
  texto,
  paso,
  totalPasos = 4,
}: PropiedadesConsentimiento) {
  const { api } = useSesion();
  const consulta = useCarga(api.textoConsentimientoVigente, texto === undefined);
  const vigente = texto !== undefined ? texto : consulta.datos;

  return (
    <View style={estilos.contenedor}>
      {paso ? <IndicadorPasos actual={paso} total={totalPasos} /> : null}

      <Text style={[tipografia.titulo, estilos.titulo]}>Consentimiento informado</Text>
      <Text style={[tipografia.cuerpo, estilos.texto]}>
        Entrega el celular al apoderado para que lea el texto completo antes de aceptar.
      </Text>

      {consulta.error && texto === undefined ? (
        <Text style={[tipografia.nota, estilos.error]}>{consulta.error}</Text>
      ) : null}

      <View style={estilos.textoMarco}>
        {vigente ? (
          <ScrollView style={estilos.textoDesplazable} nestedScrollEnabled>
            <Text style={[tipografia.cuerpo, estilos.parrafo]}>
              {vigente.contenido}
            </Text>
          </ScrollView>
        ) : (
          <Text style={[tipografia.cuerpo, estilos.texto]}>
            {consulta.cargando ? "Cargando el texto del consentimiento…" : "No hay texto vigente."}
          </Text>
        )}
      </View>

      {vigente ? (
        <Text style={[tipografia.nota, estilos.version]}>Versión {vigente.version}</Text>
      ) : null}

      <Boton
        etiqueta="El apoderado acepta"
        alPresionar={() => vigente && alAceptar(vigente)}
        deshabilitado={!vigente}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.l },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  error: { color: colores.errorTexto },
  parrafo: { color: colores.texto, lineHeight: 24 },
  textoMarco: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.tarjeta,
    padding: espacio.l,
    maxHeight: 320,
  },
  textoDesplazable: { maxHeight: 280 },
  version: { color: colores.textoTenue },
});
