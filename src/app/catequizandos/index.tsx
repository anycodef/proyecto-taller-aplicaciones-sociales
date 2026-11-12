import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export default function ListaCatequizandos() {
  const { apiCatequizandos } = useSesion();
  const cargarCiclo = () => apiCatequizandos.cicloAbierto();
  const { datos: ciclo, error: errorCiclo, cargando: cargandoCiclo } = useCarga(cargarCiclo);

  const cicloAbierto = ciclo;
  const cargarGrupos = () =>
    cicloAbierto ? apiCatequizandos.listarGrupos(cicloAbierto.id) : Promise.resolve([]);
  const { datos: grupos, error: errorGrupos, cargando: cargandoGrupos, recargar } = useCarga(
    cargarGrupos,
    cicloAbierto != null
  );

  if (cargandoCiclo || cargandoGrupos) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Cargando…</Text>
      </ScrollView>
    );
  }

  if (errorCiclo || errorGrupos) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.nota, estilos.error]}>
          {errorCiclo ?? errorGrupos}
        </Text>
        <Boton etiqueta="Recargar" variante="secundario" alPresionar={recargar} />
      </ScrollView>
    );
  }

  if (!cicloAbierto) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.titulo, estilos.titulo]}>Catequizandos</Text>
        <Aviso tono="advertencia" mensaje="No hay un ciclo abierto." />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.header}>
        <Text style={[tipografia.titulo, estilos.titulo]}>Catequizandos</Text>
        <Text style={[tipografia.cuerpo, estilos.subtitulo]}>
          Ciclo: {cicloAbierto.nombre}
        </Text>
      </View>

      {!grupos || grupos.length === 0 ? (
        <Aviso tono="informativo" mensaje="No hay grupos en este ciclo." />
      ) : null}

      <View style={estilos.lista}>
        {(grupos ?? []).map((grupo) => (
          <FilaNavegacion
            key={grupo.id}
            titulo={grupo.nombre}
            subtitulo={`Edades ${grupo.edadMinima}-${grupo.edadMaxima} · ${grupo.total} niño${grupo.total !== 1 ? "s" : ""}`}
            derecha={
              <Insignia
                texto={grupo.sinCatequista ? "Sin catequista" : "Con catequista"}
                tono={grupo.sinCatequista ? "advertencia" : "solido"}
              />
            }
            alPresionar={() => {
              void router.push(`/catequizandos?grupo=${grupo.id}` as Href);
            }}
          />
        ))}
      </View>

      <Boton etiqueta="Recargar" variante="secundario" alPresionar={recargar} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  header: { gap: espacio.s },
  titulo: { color: colores.texto },
  subtitulo: { color: colores.textoSuave },
  lista: { gap: espacio.s },
  texto: { color: colores.textoSuave },
  error: { color: colores.errorTexto },
});
