import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta } from "@/components/ui";
import { domingoDeReferencia, type ReporteMisa } from "@/lib/asistencia/reporte-misa";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import { fechaValida } from "@/lib/asistencia/sesiones";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useInstante } from "@/plataforma/asistencia/use-instante";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function horaLima(instante: string): string {
  const lima = new Date(Date.parse(instante) - 5 * 60 * 60 * 1000);
  return `${lima.getUTCHours()}:${String(lima.getUTCMinutes()).padStart(2, "0")}`;
}

const TIPO: Record<string, { texto: string; tono: "neutro" | "advertencia" }> = {
  escaneo: { texto: "Escaneo", tono: "neutro" },
  manual: { texto: "Manual", tono: "advertencia" },
  lista: { texto: "Lista", tono: "neutro" },
};

/**
 * Reporte de misa (APP-36): presentes frente a activos, con la hora del
 * celular, quién registró (su identidad operativa, nunca el nombre real de un
 * catequista menor) y el tipo de registro. Solo en línea (RF-304, RF-312).
 */
export default function ReporteMisaPantalla({ fecha: fechaProp }: { fecha?: string }) {
  const { cliente } = useSesion();
  const conectado = useConexion();
  const instante = useInstante();
  const parametros = useLocalSearchParams<{ fecha?: string | string[] }>();
  const pedida = (Array.isArray(parametros?.fecha) ? parametros.fecha[0] : parametros?.fecha) ?? fechaProp;
  const fecha = pedida && fechaValida(pedida) ? pedida : domingoDeReferencia(fechaEnLima(instante));

  const cargar = useCallback(
    () => cliente.solicitar<ReporteMisa>("GET", `/asistencia/misas/${fecha}/reporte`),
    [cliente, fecha]
  );
  const { datos, error, cargando, recargar } = useCarga(cargar, conectado === true);
  const [, mes, dia] = fecha.split("-").map(Number);

  if (conectado === false) {
    return (
      <View style={estilos.contenido}>
        <Insignia texto="Requiere conexión" tono="neutro" />
        <Aviso tono="advertencia" mensaje="El reporte de misa solo se consulta con conexión." />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.encabezado, estilos.texto]}>{`Misa del ${dia} de ${MESES[mes - 1]}`}</Text>
      {cargando && !datos ? <Text style={[tipografia.cuerpo, estilos.suave]}>Armando el reporte…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {error ? <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} /> : null}
      {datos ? (
        <>
          <Text style={[tipografia.titulo, estilos.texto]}>
            {`${datos.totalPresentes} de ${datos.totalActivos} niños presentes`}
          </Text>
          <Text style={[tipografia.cuerpo, estilos.suave]}>
            {`${datos.totalManuales} ${datos.totalManuales === 1 ? "registro manual" : "registros manuales"}.`}
          </Text>
          <View style={estilos.fila}>
            <Insignia texto="Requiere conexión" tono="neutro" />
          </View>
          {datos.cancelada ? <Aviso tono="informativo" mensaje="Ese domingo no hubo misa." /> : null}
          <View style={estilos.lista}>
            {datos.presentes.map((presente) => {
              const tipo = TIPO[presente.tipoRegistro] ?? TIPO.escaneo;
              return (
                <Tarjeta key={presente.catequizandoId}>
                  <View style={estilos.registro}>
                    <Text style={[tipografia.cuerpoFuerte, estilos.texto]}>{horaLima(presente.horaDispositivo)}</Text>
                    <View style={estilos.flex}>
                      <Text numberOfLines={1} style={[tipografia.cuerpoFuerte, estilos.texto]}>
                        {presente.nombre}
                      </Text>
                      <Text style={[tipografia.nota, estilos.suave]}>
                        {`Registró ${presente.registradores.join(", ")} · llegó ${horaLima(presente.recibidoEn)}`}
                      </Text>
                    </View>
                    <Insignia texto={tipo.texto} tono={tipo.tono} />
                  </View>
                </Tarjeta>
              );
            })}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  lista: { gap: espacio.s },
  registro: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  flex: { flex: 1 },
  fila: { flexDirection: "row" },
  texto: { color: colores.texto },
  suave: { color: colores.textoSuave },
});
