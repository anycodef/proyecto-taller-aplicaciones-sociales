import { Pressable, StyleSheet, Text, View } from "react-native";

import { Insignia, Tarjeta } from "@/components/ui";
import type { AusenciaJustificable } from "@/lib/justificaciones/cliente-justificaciones";
import { agruparPorNino, claveAusencia, etiquetaSesion, fechaCorta } from "@/lib/justificaciones/seleccion";
import { alturaMinimaToque, colores, espacio, tipografia } from "@/tema";

export interface PropiedadesSelectorAusencias {
  ausencias: readonly AusenciaJustificable[];
  seleccion: ReadonlySet<string>;
  alAlternar: (clave: string) => void;
}

/** Casillas de varias ausencias a la vez, agrupadas por hijo; cada una con la fecha en que vence el plazo (RF-401, RF-405). */
export function SelectorAusencias({ ausencias, seleccion, alAlternar }: PropiedadesSelectorAusencias) {
  return (
    <View style={estilos.lista}>
      {agruparPorNino(ausencias).map((fila) => (
        <Tarjeta key={fila.catequizandoId}>
          <Text style={[tipografia.cuerpoFuerte, estilos.nombre]}>{fila.nombre}</Text>
          {fila.ausencias.map((ausencia) => {
            const clave = claveAusencia(ausencia);
            const marcada = seleccion.has(clave);
            return (
              <Pressable
                key={clave}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcada }}
                accessibilityLabel={`${etiquetaSesion(ausencia.tipoSesion)} del ${fechaCorta(ausencia.fecha)}`}
                onPress={() => alAlternar(clave)}
                style={estilos.fila}
              >
                <View style={[estilos.casilla, marcada ? estilos.casillaMarcada : null]}>
                  {marcada ? <Text style={estilos.marca}>✓</Text> : null}
                </View>
                <Text style={[tipografia.cuerpo, estilos.texto]}>
                  {etiquetaSesion(ausencia.tipoSesion)} · {fechaCorta(ausencia.fecha)}
                </Text>
                <Insignia texto={`Vence ${fechaCorta(ausencia.venceEn.slice(0, 10))}`} tono="neutro" />
              </Pressable>
            );
          })}
        </Tarjeta>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.m },
  nombre: { color: colores.texto },
  fila: { flexDirection: "row", alignItems: "center", gap: espacio.m, minHeight: alturaMinimaToque },
  casilla: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: colores.primario, borderColor: colores.primario },
  marca: { color: colores.primarioTexto, fontWeight: "700" },
  texto: { flex: 1, color: colores.texto },
});
