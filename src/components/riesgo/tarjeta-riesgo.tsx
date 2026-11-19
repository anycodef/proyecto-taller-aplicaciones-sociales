import { StyleSheet, Text, View } from "react-native";

import { Insignia, Tarjeta, type TonoInsignia } from "@/components/ui";
import type { FilaRiesgo } from "@/lib/riesgo/api";
import { explicarPaso } from "@/lib/riesgo/explicacion";
import type { EstadoFalta, Paso } from "@/lib/riesgo/tipos";
import { fechaCorta } from "@/lib/justificaciones/seleccion";
import { colores, espacio, tipografia } from "@/tema";

const TONOS: Record<Paso, TonoInsignia> = {
  alerta_retiro: "error",
  citacion: "advertencia",
  contacto: "suave",
  seguimiento: "neutro",
  sin_riesgo: "neutro",
  retirado: "neutro",
};

const ESTADOS_FALTA: Record<EstadoFalta, string> = {
  suma: "suma",
  pendiente_justificar: "pendiente de justificar",
  en_revision: "en revisión",
  justificada: "justificada",
};

export interface PropiedadesTarjetaRiesgo {
  fila: FilaRiesgo;
}

/** Un niño en riesgo: su paso, por qué está ahí y las fechas de las faltas con su estado (RF-707, RNF-702). */
export function TarjetaRiesgo({ fila }: PropiedadesTarjetaRiesgo) {
  const explicacion = explicarPaso(fila);
  return (
    <Tarjeta tono={fila.paso === "alerta_retiro" ? "advertencia" : "neutra"}>
      <View style={estilos.cabecera}>
        <Text style={[tipografia.cuerpoFuerte, estilos.titulo]}>{fila.nombre}</Text>
        <Insignia texto={explicacion.titulo} tono={TONOS[fila.paso]} />
      </View>
      <Text style={[tipografia.nota, estilos.suave]}>
        {fila.grupoNombre} · {fila.conteo} {fila.conteo === 1 ? "falta" : "faltas"}
      </Text>
      <Text style={[tipografia.cuerpo, estilos.texto]}>{explicacion.motivo}</Text>
      {explicacion.siguientePaso ? <Text style={[tipografia.nota, estilos.suave]}>{explicacion.siguientePaso}</Text> : null}
      {explicacion.pendientes ? <Text style={[tipografia.nota, estilos.pendiente]}>{explicacion.pendientes}</Text> : null}
      <View style={estilos.faltas}>
        {fila.faltasOrigen
          .filter((falta) => falta.origen !== "papel")
          .map((falta) => (
            <Insignia key={`${falta.fecha}-${falta.origen}`} texto={`${fechaCorta(falta.fecha)} · ${ESTADOS_FALTA[falta.estado]}`} tono={falta.estado === "suma" ? "error" : "neutro"} />
          ))}
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.m },
  titulo: { flex: 1, color: colores.texto },
  texto: { color: colores.texto },
  suave: { color: colores.textoSuave },
  pendiente: { color: colores.advertenciaTexto },
  faltas: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s },
});
