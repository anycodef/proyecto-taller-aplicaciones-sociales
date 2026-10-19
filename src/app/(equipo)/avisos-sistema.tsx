import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export default function AvisosSistema() {
  const { api } = useSesion();
  const { datos, error, cargando, recargar } = useCarga(api.listarAvisos);

  if (cargando) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Cargando avisos…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Avisos del sistema</Text>

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}

      {datos?.length === 0 ? (
        <Text style={[tipografia.cuerpo, estilos.texto]}>No hay avisos pendientes.</Text>
      ) : null}

      <View style={estilos.lista}>
        {datos?.map((aviso) => (
          <FilaNavegacion
            key={aviso.id}
            titulo={`Se rechazaron ${aviso.cantidad} ${aviso.cantidad === 1 ? "registro" : "registros"} del celular de ${aviso.identidadOperativa}`}
            subtitulo={aviso.leidoEn ? "Leído" : "Sin leer"}
            derecha={aviso.leidoEn ? undefined : <Insignia texto="Nuevo" tono="advertencia" />}
            alPresionar={
              aviso.leidoEn
                ? undefined
                : () => {
                    void api.marcarAvisoLeido(aviso.id).then(recargar);
                  }
            }
          />
        ))}
      </View>

      <Boton etiqueta="Actualizar" variante="secundario" alPresionar={recargar} />
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
