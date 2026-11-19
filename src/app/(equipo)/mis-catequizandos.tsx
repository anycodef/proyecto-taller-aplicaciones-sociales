import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, CampoTexto, FilaNavegacion, Insignia } from "@/components/ui";
import { agruparNomina, type GrupoNomina, type NinoNomina } from "@/lib/catequizandos/nomina";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { colores, espacio, tipografia } from "@/tema";

/**
 * Los niños de los grupos del catequista, desde la nómina que el celular ya tiene (RNF-306): se ve también sin conexión.
 * Tocar a un niño abre su perfil, que sí se consulta en línea porque trae documentos (RNF-101).
 */
export default function MisCatequizandos() {
  const { almacen, conConexion, cargando, sincronizando, sincronizarAhora } = useAsistencia();
  const [busqueda, setBusqueda] = useState("");

  const grupos = filasDe(almacen, "grupos") as unknown as GrupoNomina[];
  const ninos = filasDe(almacen, "catequizandos") as unknown as NinoNomina[];
  const visibles = useMemo(() => agruparNomina(grupos, ninos, busqueda), [grupos, ninos, busqueda]);
  const total = ninos.filter((nino) => nino.activo !== false).length;

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Text style={[tipografia.titulo, estilos.titulo]}>Mis catequizandos</Text>
      <Text style={[tipografia.cuerpo, estilos.suave]}>
        {cargando ? "Abriendo tu sesión…" : `${total} ${total === 1 ? "niño" : "niños"} en ${grupos.length} ${grupos.length === 1 ? "grupo" : "grupos"}`}
      </Text>

      {!conConexion ? <Aviso tono="advertencia" mensaje="Sin conexión. Ves la nómina guardada en el celular; el perfil necesita conexión." /> : null}

      {total === 0 && !cargando ? (
        <View style={estilos.bloque}>
          <Aviso tono="informativo" mensaje="Todavía no hay niños descargados. Conéctate para bajar la nómina." />
          <Boton etiqueta={sincronizando ? "Sincronizando…" : "Sincronizar ahora"} cargando={sincronizando} alPresionar={() => void sincronizarAhora()} />
        </View>
      ) : (
        <CampoTexto etiqueta="Buscar por nombre" valor={busqueda} alCambiar={setBusqueda} marcador="Nombre o apellido" />
      )}

      {total > 0 && visibles.length === 0 ? <Aviso tono="informativo" mensaje="Ningún niño coincide con la búsqueda." /> : null}

      {visibles.map((grupo) => (
        <View key={grupo.id} style={estilos.bloque}>
          <View style={estilos.cabeceraGrupo}>
            <Text style={[tipografia.encabezado, estilos.titulo]}>{grupo.nombre}</Text>
            <Insignia texto={grupo.esMio ? "Mi grupo" : "Otro grupo"} tono={grupo.esMio ? "solido" : "neutro"} />
          </View>
          {grupo.ninos.map((nino) => (
            <FilaNavegacion
              key={nino.id}
              titulo={`${nino.nombres} ${nino.apellidos}`}
              subtitulo="Ver perfil, asistencia y documentos"
              alPresionar={() => router.push(`/catequizandos/${nino.id}` as Href)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  bloque: { gap: espacio.s },
  cabeceraGrupo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.m },
});
