import { router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta } from "@/components/ui";
import {
  documentosPendientes,
  estadoDeAsistencia,
  estadoDeDocumento,
  ETIQUETA_DOCUMENTO,
  textoRelacion,
  ultimosDomingos,
  type PerfilApi,
} from "@/lib/catequizandos/perfil";
import { fechaCorta } from "@/lib/justificaciones/seleccion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

/**
 * Perfil único del niño (spec 002, RF-201): datos, grupo, asistencia del ciclo, estado de los documentos y apoderados.
 * Los documentos muestran solo su estado, nunca una imagen; salud y neurodivergencia no se muestran aquí (RNF-101).
 */
export default function PerfilCatequizando({ id: idPropio }: { id?: string }) {
  const { apiCatequizandos } = useSesion();
  const parametros = useLocalSearchParams<{ id?: string }>();
  const id = idPropio ?? parametros?.id ?? "";
  // Sin useCallback, `useCarga` repite la consulta en cada render.
  const cargar = useCallback(() => apiCatequizandos.consultarPerfil(id) as Promise<PerfilApi>, [apiCatequizandos, id]);
  const { datos: nino, error, cargando, recargar } = useCarga<PerfilApi>(cargar);

  if (cargando) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.suave]}>Cargando perfil…</Text>
      </ScrollView>
    );
  }

  if (error || !nino) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Aviso tono="error" mensaje={error ?? "No se encontró el perfil."} />
        <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} />
        <Boton etiqueta="Volver" variante="enlace" alPresionar={() => router.back()} />
      </ScrollView>
    );
  }

  const asistencia = nino.resumenes?.resumenAsistencia;
  const recientes = asistencia ? ultimosDomingos(asistencia.domingos, 5) : [];
  const pendientes = documentosPendientes(nino.documentos);

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.cabecera}>
        <View style={estilos.avatar}>
          <Text style={estilos.avatarTexto}>
            {nino.nombres.charAt(0)}
            {nino.apellidos.charAt(0)}
          </Text>
        </View>
        <View style={estilos.textos}>
          <Text style={[tipografia.titulo, estilos.titulo]}>
            {nino.nombres} {nino.apellidos}
          </Text>
          <Text style={[tipografia.cuerpo, estilos.suave]}>
            {nino.grupo?.nombre ?? "Sin grupo"} · {nino.edad} años
          </Text>
        </View>
      </View>

      <Tarjeta>
        <Text style={[tipografia.etiqueta, estilos.suave]}>Datos del niño</Text>
        <Text style={[tipografia.cuerpo, estilos.titulo]}>Nació el {nino.fechaNacimiento}</Text>
        <Text style={[tipografia.cuerpo, estilos.titulo]}>{nino.sexo === "femenino" ? "Femenino" : "Masculino"}</Text>
        <Text style={[tipografia.cuerpo, estilos.titulo]}>{nino.bautizado ? "Bautizado" : "Aún no bautizado"}</Text>
      </Tarjeta>

      <Text style={[tipografia.encabezado, estilos.titulo]}>Asistencia del ciclo</Text>
      {asistencia ? (
        <Tarjeta tono={asistencia.faltas >= 2 ? "advertencia" : "neutra"}>
          <Text style={[tipografia.cuerpoFuerte, estilos.titulo]}>
            {asistencia.faltas} {asistencia.faltas === 1 ? "falta" : "faltas"} sin justificar
          </Text>
          <Text style={[tipografia.nota, estilos.suave]}>Una falta es un domingo sin misa ni catequesis.</Text>
          {recientes.map((domingo) => (
            <View key={domingo.fecha} style={estilos.fila}>
              <Text style={[tipografia.cuerpo, estilos.fecha]}>{fechaCorta(domingo.fecha)}</Text>
              <Insignia texto={`Misa: ${estadoDeAsistencia(domingo.misa).texto}`} tono={estadoDeAsistencia(domingo.misa).tono} />
              <Insignia texto={`Catequesis: ${estadoDeAsistencia(domingo.catequesis).texto}`} tono={estadoDeAsistencia(domingo.catequesis).tono} />
            </View>
          ))}
        </Tarjeta>
      ) : (
        <Aviso tono="informativo" mensaje="Todavía no hay resumen de asistencia." />
      )}

      <Text style={[tipografia.encabezado, estilos.titulo]}>Documentos de inscripción</Text>
      <Tarjeta>
        {pendientes > 0 ? <Text style={[tipografia.nota, estilos.pendiente]}>{pendientes} por entregar o corregir</Text> : null}
        {nino.documentos.map((documento) => {
          const estado = estadoDeDocumento(documento.estado);
          return (
            <View key={documento.id} style={estilos.filaDocumento}>
              <Text style={[tipografia.cuerpo, estilos.titulo, estilos.texto]}>{ETIQUETA_DOCUMENTO[documento.tipo] ?? documento.tipo}</Text>
              <Insignia texto={estado.texto} tono={estado.tono} />
            </View>
          );
        })}
      </Tarjeta>

      <Text style={[tipografia.encabezado, estilos.titulo]}>Apoderados</Text>
      <Tarjeta>
        {nino.apoderados.length === 0 ? <Text style={[tipografia.cuerpo, estilos.suave]}>Sin apoderados vinculados.</Text> : null}
        {nino.apoderados.map((apoderado) => (
          <View key={apoderado.id} style={estilos.filaDocumento}>
            <Text style={[tipografia.cuerpo, estilos.titulo, estilos.texto]}>
              {apoderado.nombres} {apoderado.apellidos}
            </Text>
            <Insignia texto={textoRelacion(apoderado.relacion, apoderado.detalleRelacion)} tono="suave" />
          </View>
        ))}
      </Tarjeta>

      <Boton etiqueta="Volver" variante="enlace" alPresionar={() => router.back()} />
      <Boton etiqueta="Mis catequizandos" variante="enlace" alPresionar={() => router.replace("/mis-catequizandos" as Href)} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colores.primario, alignItems: "center", justifyContent: "center" },
  avatarTexto: { color: colores.primarioTexto, fontSize: 18, fontWeight: "600" },
  textos: { flex: 1, gap: espacio.xs },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  pendiente: { color: colores.advertenciaTexto },
  fila: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: espacio.s },
  fecha: { color: colores.texto, minWidth: 56 },
  filaDocumento: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.m },
  texto: { flex: 1 },
});
