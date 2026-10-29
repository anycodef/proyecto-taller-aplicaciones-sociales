import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, FilaNavegacion, Insignia, Tarjeta } from "@/components/ui";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

function sexoLabel(sexo: "femenino" | "masculino"): string {
  return sexo === "femenino" ? "Femenino" : "Masculino";
}

type PerfilCatequizandoData = {
  id: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: "femenino" | "masculino";
  bautizado: boolean;
  grupo: string;
  estado: "vigente" | "inactivo" | "anonimizado";
};

export default function PerfilCatequizando({ id }: { id: string }) {
  const { apiCatequizandos } = useSesion();
  const cargar = () => apiCatequizandos.consultarPerfil(id) as Promise<PerfilCatequizandoData>;
  const { datos: nino, error, cargando } = useCarga<PerfilCatequizandoData>(cargar);

  if (cargando) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Cargando perfil…</Text>
      </ScrollView>
    );
  }

  if (error || !nino) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.nota, estilos.error]}>
          {error ?? "No se encontró el perfil."}
        </Text>
        <Boton
          etiqueta="Volver"
          variante="secundario"
          alPresionar={() => router.replace("/catequizandos" as Href)}
        />
      </ScrollView>
    );
  }

  const edad = Math.floor(
    (new Date().getTime() - new Date(nino.fechaNacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.header}>
        <View style={estilos.avatar}>
          <Text style={estilos.avatarTexto}>{nino.nombres.charAt(0)}{nino.apellidos.charAt(0)}</Text>
        </View>
        <View style={estilos.textos}>
          <Text style={[tipografia.titulo, estilos.titulo]}>{nino.nombres} {nino.apellidos}</Text>
          <Text style={[tipografia.cuerpo, estilos.grupo]}>{nino.grupo} · {edad} años</Text>
          <Insignia
            texto={nino.estado === "vigente" ? "Activo" : nino.estado === "inactivo" ? "Inactivo" : "Anonimizado"}
            tono={nino.estado === "vigente" ? "solido" : "neutro"}
          />
        </View>
      </View>

      <Tarjeta>
        <Text style={[tipografia.etiqueta, estilos.etiquetaTexto]}>Datos del niño</Text>
        <FilaNavegacion
          titulo="Fecha de nacimiento"
          subtitulo={nino.fechaNacimiento}
          alPresionar={undefined}
        />
        <FilaNavegacion
          titulo="Sexo"
          subtitulo={sexoLabel(nino.sexo)}
          alPresionar={undefined}
        />
        <FilaNavegacion
          titulo="Bautizado"
          subtitulo={nino.bautizado ? "Sí" : "No"}
          alPresionar={undefined}
        />
      </Tarjeta>

      <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>
        Apoderados
      </Text>
      <Text style={[tipografia.cuerpo, estilos.textoVacio]}>
        Los apoderados se muestran tras vincularlos desde la ficha de la cuenta.
      </Text>

      <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>
        Documentos
      </Text>
      <Aviso tono="informativo" mensaje="Consulta los estados de los documentos en línea." />

      <Boton
        etiqueta="Volver a la lista"
        variante="enlace"
        alPresionar={() => router.replace("/catequizandos" as Href)}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  header: { gap: espacio.m, marginBottom: espacio.m },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colores.primarioSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: colores.primarioTexto, fontSize: 18, fontWeight: "600" },
  textos: { gap: espacio.s },
  titulo: { color: colores.texto },
  grupo: { color: colores.textoSuave },
  etiquetaTexto: { color: colores.textoSuave },
  textoVacio: { color: colores.textoSuave },
  tituloSeccion: { color: colores.primario, marginTop: espacio.m, marginBottom: espacio.s },
  texto: { color: colores.textoSuave },
  error: { color: colores.errorTexto },
});
