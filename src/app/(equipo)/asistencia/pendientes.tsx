import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { colores, espacio, tipografia } from "@/tema";

type NinoLocal = { id: string; nombres: string; apellidos: string };

export default function Pendientes() {
  const {
    conConexion,
    almacen,
    pendientes,
    ultimaSincronizacion,
    sincronizando,
    error,
    sincronizarAhora,
  } = useAsistencia();

  const ninos = filasDe(almacen, "catequizandos") as unknown as NinoLocal[];
  const nombreDe = (id: string | null) => {
    const nino = ninos.find((fila) => fila.id === id);
    return nino ? `${nino.nombres} ${nino.apellidos}` : "Niño";
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.header}>
        <Text style={[tipografia.titulo, estilos.titulo]}>Por enviar</Text>
        <Insignia
          texto={conConexion ? "Conectado" : "Sin conexión"}
          tono={conConexion ? "solido" : "advertencia"}
        />
      </View>

      {!conConexion ? (
        <Aviso
          tono="advertencia"
          mensaje="Sin conexión. Los registros quedan en el celular y se envían solos al volver la red."
        />
      ) : null}

      {error ? <Aviso tono="error" mensaje={error} /> : null}

      <View style={estilos.bloque}>
        <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>
          {pendientes.total === 0
            ? "No hay registros esperando"
            : `${pendientes.total} ${pendientes.total === 1 ? "registro esperando" : "registros esperando"} señal`}
        </Text>
        <Text style={[tipografia.nota, estilos.nota]}>
          Se envían solos cuando vuelve la conexión.
        </Text>
      </View>

      {pendientes.total === 0 ? (
        <Aviso tono="informativo" mensaje="No hay registros por enviar." />
      ) : null}

      <View style={estilos.lista}>
        {almacen.pendientes.marcas.map((marca) => (
          <FilaNavegacion
            key={marca.id}
            titulo={nombreDe(marca.fila.catequizando_id)}
            subtitulo={`${marca.fila.valor === "presente" ? "Presente" : "Ausente"} · ${
              marca.fila.tipo_registro
            }`}
          />
        ))}
      </View>

      <Boton
        etiqueta="Sincronizar ahora"
        alPresionar={() => void sincronizarAhora()}
        cargando={sincronizando}
        deshabilitado={!conConexion || pendientes.total === 0}
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
  bloque: { gap: espacio.s },
  tituloSeccion: { color: colores.primario },
  nota: { color: colores.textoTenue, textAlign: "center" },
  lista: { gap: espacio.s },
});
