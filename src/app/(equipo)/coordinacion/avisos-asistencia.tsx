import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta } from "@/components/ui";
import { etiquetaAviso, ordenarAvisos, textoAviso, type AvisoAsistencia } from "@/lib/asistencia/avisos-asistencia";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

/**
 * Avisos de asistencia (APP-35): carnés inválidos, conflictos y revisión
 * cruzada. Se leen y atienden en línea; no se guardan en el celular
 * (RF-303, RF-308, RF-310).
 */
export default function AvisosAsistencia() {
  const { cliente } = useSesion();
  const { almacen } = useAsistencia();
  const conectado = useConexion();
  const [atendiendo, setAtendiendo] = useState<string | null>(null);
  const [atendidos, setAtendidos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    () => cliente.solicitar<AvisoAsistencia[]>("GET", "/asistencia/avisos?estado=abierto"),
    [cliente]
  );
  const { datos, error: errorCarga, cargando, recargar } = useCarga(cargar, conectado === true);

  const avisos = useMemo(
    () => ordenarAvisos((datos ?? []).filter((aviso) => !atendidos.has(aviso.id))),
    [datos, atendidos]
  );

  const nombreDe = (catequizandoId: string | null): string | null => {
    const fila = catequizandoId ? almacen.colecciones.catequizandos?.[catequizandoId] : undefined;
    return fila ? `${String(fila.apellidos)}, ${String(fila.nombres)}` : null;
  };

  const atender = async (id: string) => {
    setAtendiendo(id);
    setError(null);
    try {
      await cliente.solicitar("POST", `/asistencia/avisos/${id}/atencion`);
      setAtendidos((actuales) => new Set(actuales).add(id));
    } catch {
      setError("No pudimos marcarlo como atendido. Revisa tu conexión.");
    } finally {
      setAtendiendo(null);
    }
  };

  if (conectado === false) {
    return (
      <View style={estilos.contenido}>
        <Insignia texto="Requiere conexión" tono="neutro" />
        <Aviso tono="advertencia" mensaje="Los avisos de asistencia solo se consultan con conexión." />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.fila}>
        <Insignia texto="Requiere conexión" tono="neutro" />
      </View>
      {cargando && !datos ? <Text style={[tipografia.cuerpo, estilos.suave]}>Buscando avisos…</Text> : null}
      {errorCarga ? <Aviso tono="error" mensaje={errorCarga} /> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {datos && avisos.length === 0 ? (
        <Tarjeta>
          <Text style={[tipografia.cuerpo, estilos.suave]}>No hay avisos por atender.</Text>
        </Tarjeta>
      ) : null}
      <View style={estilos.lista}>
        {avisos.map((aviso) => {
          const { etiqueta, tono } = etiquetaAviso(aviso.tipo);
          return (
            <Tarjeta key={aviso.id}>
              <View style={estilos.tarjeta}>
                <View style={estilos.fila}>
                  <Insignia texto={etiqueta} tono={tono} />
                </View>
                <Text style={[tipografia.cuerpo, estilos.texto]}>{textoAviso(aviso, nombreDe(aviso.catequizandoId))}</Text>
                <View style={estilos.fila}>
                  <Boton
                    etiqueta="Marcar atendido"
                    variante="secundario"
                    cargando={atendiendo === aviso.id}
                    alPresionar={() => void atender(aviso.id)}
                  />
                </View>
              </View>
            </Tarjeta>
          );
        })}
      </View>
      {errorCarga ? <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  lista: { gap: espacio.m },
  tarjeta: { gap: espacio.s },
  fila: { flexDirection: "row" },
  texto: { color: colores.texto },
  suave: { color: colores.textoSuave },
});
