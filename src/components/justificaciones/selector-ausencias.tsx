import { colores, espacio, radio, tipografia } from '@/tema';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface OpcionAusencia {
  clave: string;
  titulo: string;
  detalle: string;
  nota?: string;
}

export interface PropiedadesSelectorAusencias {
  opciones: readonly OpcionAusencia[];
  seleccionadas: readonly string[];
  alCambiar: (seleccionadas: string[]) => void;
}

/** Marca una o varias ausencias, de uno o varios hijos; quien la usa arma las opciones. */
export function SelectorAusencias({ opciones, seleccionadas, alCambiar }: PropiedadesSelectorAusencias) {
  const alternar = (clave: string) =>
    alCambiar(seleccionadas.includes(clave) ? seleccionadas.filter((c) => c !== clave) : [...seleccionadas, clave]);

  return (
    <View style={estilos.lista}>
      {opciones.map((opcion) => {
        const marcada = seleccionadas.includes(opcion.clave);
        return (
          <Pressable
            key={opcion.clave}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcada }}
            accessibilityLabel={`${opcion.titulo}, ${opcion.detalle}`}
            onPress={() => alternar(opcion.clave)}
            style={[estilos.fila, marcada ? estilos.marcada : null]}
          >
            <View style={[estilos.casilla, marcada ? estilos.casillaMarcada : null]}>
              {marcada ? <Text style={estilos.check}>✓</Text> : null}
            </View>
            <View style={estilos.textos}>
              <Text style={[tipografia.cuerpoFuerte, { color: colores.texto }]}>{opcion.titulo}</Text>
              <Text style={[tipografia.nota, { color: colores.textoSuave }]}>{opcion.detalle}</Text>
              {opcion.nota ? <Text style={[tipografia.nota, { color: colores.textoTenue }]}>{opcion.nota}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.l,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  marcada: { borderWidth: 2, borderColor: colores.primario, backgroundColor: colores.primarioSuave },
  casilla: {
    width: espacio.xl,
    height: espacio.xl,
    borderRadius: radio.campo / 2,
    borderWidth: 2,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaMarcada: { backgroundColor: colores.primario, borderColor: colores.primario },
  check: { color: colores.primarioTexto, ...tipografia.etiqueta },
  textos: { flex: 1, gap: espacio.xs },
});
