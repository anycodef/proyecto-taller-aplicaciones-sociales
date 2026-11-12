import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { colores, espacio, tipografia } from "@/tema";

type GrupoLocal = { id: string; nombre: string; total?: number; es_mio?: boolean };

export default function MenuAsistencia() {
  const { cargando, conConexion, almacen, pendientes, ultimaSincronizacion, sincronizando, error, sincronizarAhora } =
    useAsistencia();

  const grupos: GrupoLocal[] = filasDe(almacen, "grupos") as unknown as GrupoLocal[];
  const nomina = filasDe(almacen, "catequizandos");

  if (cargando) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Abriendo tu sesión…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.header}>
        <Text style={[tipografia.titulo, estilos.titulo]}>Pasar lista</Text>
        <Insignia
          texto={conConexion ? "Conectado" : "Sin conexión"}
          tono={conConexion ? "solido" : "advertencia"}
        />
      </View>

      {!conConexion ? (
        <Aviso
          tono="advertencia"
          mensaje="Sin conexión. Puedes marcar la asistencia: se guarda en el celular y se envía al volver la red."
        />
      ) : null}

      {error ? <Aviso tono="error" mensaje={error} /> : null}

      {pendientes.total > 0 ? (
        <>
          <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>Por enviar</Text>
          <FilaNavegacion
            titulo={`${pendientes.total} ${pendientes.total === 1 ? "registro" : "registros"} por enviar`}
            subtitulo="Se envían al volver la conexión, sin duplicar"
            alPresionar={() => router.push("/asistencia/pendientes" as never)}
          />
        </>
      ) : null}

      <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>Mis grupos</Text>
      {grupos.length === 0 ? (
        <Aviso
          tono="informativo"
          mensaje="Todavía no hay grupos descargados. Conéctate para bajar la nómina."
        />
      ) : null}

      <View style={estilos.lista}>
        {grupos.map((grupo) => {
          const ninos = nomina.filter((fila) => fila.grupo_id === grupo.id).length;
          return (
            <FilaNavegacion
              key={grupo.id}
              titulo={grupo.nombre}
              subtitulo={`${ninos} ${ninos === 1 ? "niño" : "niños"}`}
              alPresionar={() => router.push(`/asistencia/lista/${grupo.id}` as never)}
            />
          );
        })}
      </View>

      <FilaNavegacion
        titulo="Asistente de catequesis"
        subtitulo="Preguntas de doctrina con fuentes públicas"
        alPresionar={() => router.push("/asistente" as Href)}
      />

      <Boton
        etiqueta="Sincronizar ahora"
        variante="secundario"
        alPresionar={() => void sincronizarAhora()}
        cargando={sincronizando}
        deshabilitado={!conConexion}
      />

      {ultimaSincronizacion ? (
        <Text style={[tipografia.nota, estilos.nota]}>
          Última sincronización: {new Date(ultimaSincronizacion).toLocaleString("es-PE")}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  header: { gap: espacio.s },
  titulo: { color: colores.texto },
  tituloSeccion: { color: colores.primario, marginTop: espacio.m },
  texto: { color: colores.textoSuave },
  nota: { color: colores.textoTenue, textAlign: "center" },
  lista: { gap: espacio.s },
});
