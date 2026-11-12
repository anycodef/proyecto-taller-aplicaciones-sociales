import { StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia } from "@/components/ui";
import type { GrupoApi } from "@/lib/catequizandos/api";
import { colores, espacio, radio, tipografia } from "@/tema";

export type GrupoSeleccionado = {
  id: string;
  nombre: string;
  edadMinima: number;
  edadMaxima: number;
  modalidad: string;
};

export function SelectorGrupoSugerido({
  sugerencias,
  grupoSeleccionado,
  onSeleccionarGrupo,
}: {
  sugerencias: GrupoApi[];
  grupoSeleccionado: GrupoSeleccionado | null;
  onSeleccionarGrupo: (grupo: GrupoSeleccionado) => void;
}) {
  return (
    <View style={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Grupo sugerido</Text>
      <Text style={[tipografia.cuerpo, estilos.texto]}>
        Selecciona el grupo donde inscribir al niño.
      </Text>

      {sugerencias.length === 0 ? (
        <Aviso tono="informativo" mensaje="No hay grupos sugeridos para la edad y sexo del niño." />
      ) : null}

      <View style={estilos.lista}>
        {sugerencias.map((grupo) => {
          const esSeleccionado = grupoSeleccionado?.id === grupo.id;
          return (
            <View
              key={grupo.id}
              style={[
                estilos.tarjeta,
                esSeleccionado && estilos.tarjetaSeleccionada,
              ]}
            >
              <Text style={[tipografia.encabezado, estilos.nombreGrupo]}>{grupo.nombre}</Text>
              <Text style={[tipografia.cuerpo, estilos.detalleGrupo]}>
                {grupo.edadMinima}-{grupo.edadMaxima} años · {grupo.total} niño{grupo.total !== 1 ? "s" : ""}
              </Text>
              <Insignia texto={grupo.sinCatequista ? "Sin catequista" : "Con catequista"} tono={grupo.sinCatequista ? "advertencia" : "solido"} />
              <Insignia texto={grupo.modalidad} tono="suave" />
              <Boton
                etiqueta="Seleccionar"
                variante="enlace"
                alPresionar={() =>
                  onSeleccionarGrupo({
                    id: grupo.id,
                    nombre: grupo.nombre,
                    edadMinima: grupo.edadMinima,
                    edadMaxima: grupo.edadMaxima,
                    modalidad: grupo.modalidad,
                  })
                }
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: { gap: espacio.m },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  lista: { gap: espacio.s },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.tarjeta,
    padding: espacio.l,
    gap: espacio.s,
  },
  tarjetaSeleccionada: {
    borderWidth: 2,
    borderColor: colores.primario,
    backgroundColor: colores.primarioSuave,
  },
  nombreGrupo: { color: colores.texto },
  detalleGrupo: { color: colores.textoSuave },
});
