import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

function fechaCorta(instante: string): string {
  return instante ? instante.slice(0, 10) : "";
}

export default function ListaDelegaciones() {
  const { api } = useSesion();
  const { datos, error, cargando, recargar } = useCarga(api.listarDelegaciones);

  if (cargando) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Cargando delegaciones…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Delegaciones</Text>

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}

      {datos?.length === 0 ? (
        <Text style={[tipografia.cuerpo, estilos.texto]}>No hay delegaciones registradas.</Text>
      ) : null}

      <View style={estilos.lista}>
        {datos?.map((delegacion) => (
          <FilaNavegacion
            key={delegacion.id}
            titulo={`${delegacion.deleganteVisible} delega en ${delegacion.delegadoVisible}`}
            subtitulo={`Del ${fechaCorta(delegacion.desde)} al ${fechaCorta(delegacion.hasta)}`}
            derecha={
              <Insignia
                texto={delegacion.revocadaEn ? "Revocada" : "Vigente"}
                tono={delegacion.revocadaEn ? "error" : "solido"}
              />
            }
            alPresionar={
              delegacion.revocadaEn
                ? undefined
                : () => {
                    void api.revocarDelegacion(delegacion.id).then(recargar);
                  }
            }
          />
        ))}
      </View>

      <Boton
        etiqueta="Delegar funciones"
        alPresionar={() => router.push("/delegaciones/nueva")}
      />
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
