import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, CampoTexto, FilaNavegacion, GrupoOpciones, Insignia, Tarjeta } from "@/components/ui";
import { puedeConfigurarSesiones } from "@/lib/asistencia/autorizacion";
import { domingosDeSesiones } from "@/lib/asistencia/avisos-asistencia";
import { cambiarSesion, ERRORES_CAMBIO_SESION, sesionesVigentes } from "@/lib/asistencia/cambio-sesion";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const REALIZA = [
  { valor: "si", etiqueta: "Se realiza" },
  { valor: "no", etiqueta: "Sin realizar" },
] as const;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fechaLarga(fecha: string): string {
  const [, mes, dia] = fecha.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
}

type Edicion = {
  fecha: string;
  misa: "si" | "no";
  catequesis: "si" | "no";
  motivo: string;
  inicio: string;
  fin: string;
};

/**
 * Domingos del ciclo (APP-34): la coordinación marca un domingo sin misa o
 * sin catequesis, con motivo, o cambia la ventana de la misa. El cambio queda
 * en el celular y se envía al sincronizar (RF-301).
 */
export default function SesionesDelCiclo() {
  const { contexto } = useSesion();
  const { almacen, conConexion, repositorio, sincronizarAhora } = useAsistencia();
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);

  const sesiones = useMemo(
    () => sesionesVigentes(filasDe(almacen, "sesiones"), almacen.pendientes),
    [almacen]
  );
  const domingos = useMemo(() => domingosDeSesiones(sesiones), [sesiones]);

  if (!contexto || !puedeConfigurarSesiones(contexto)) {
    return (
      <View style={estilos.contenido}>
        <Aviso tono="error" mensaje="Solo la coordinación cambia los domingos del ciclo." />
      </View>
    );
  }

  const abrir = (fecha: string) => {
    const misa = sesiones.find((sesion) => sesion.fecha === fecha && sesion.tipo === "misa");
    const catequesis = sesiones.find((sesion) => sesion.fecha === fecha && sesion.tipo === "catequesis");
    setError(null);
    setGuardado(null);
    setEdicion({
      fecha,
      misa: misa?.cancelada ? "no" : "si",
      catequesis: catequesis?.cancelada ? "no" : "si",
      motivo: "",
      inicio: misa?.ventanaInicio?.slice(0, 5) ?? "",
      fin: misa?.ventanaFin?.slice(0, 5) ?? "",
    });
  };

  const guardar = () => {
    if (!edicion) return;
    setError(null);
    const filas = [];
    for (const tipo of ["misa", "catequesis"] as const) {
      const sesion = sesiones.find((fila) => fila.fecha === edicion.fecha && fila.tipo === tipo);
      if (!sesion) continue;
      const cancelada = edicion[tipo] === "no";
      const resultado = cambiarSesion(contexto, sesion, {
        cancelada,
        motivoCancelacion: cancelada ? edicion.motivo : null,
        ...(tipo === "misa" ? { ventanaInicio: edicion.inicio, ventanaFin: edicion.fin } : {}),
      });
      if (!resultado.ok) {
        setError(ERRORES_CAMBIO_SESION[resultado.error]);
        return;
      }
      const sinCambio =
        sesion.cancelada === cancelada &&
        (sesion.ventanaInicio?.slice(0, 5) ?? null) === resultado.fila.ventana_inicio &&
        (sesion.ventanaFin?.slice(0, 5) ?? null) === resultado.fila.ventana_fin;
      if (!sinCambio || sesion.porEnviar) filas.push(resultado.fila);
    }
    for (const fila of filas) repositorio.registrarSesion(fila);
    setGuardado(filas.length ? "Cambio guardado en el celular. Se envía al sincronizar." : "No había cambios.");
    setEdicion(null);
    if (filas.length && conConexion) void sincronizarAhora();
  };

  if (edicion) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.titulo, estilos.titulo]}>{fechaLarga(edicion.fecha)}</Text>
        <GrupoOpciones
          etiqueta="Misa"
          opciones={REALIZA}
          valor={edicion.misa}
          alCambiar={(valor) => setEdicion({ ...edicion, misa: valor as "si" | "no" })}
        />
        <GrupoOpciones
          etiqueta="Catequesis"
          opciones={REALIZA}
          valor={edicion.catequesis}
          alCambiar={(valor) => setEdicion({ ...edicion, catequesis: valor as "si" | "no" })}
        />
        {edicion.misa === "no" || edicion.catequesis === "no" ? (
          <CampoTexto
            etiqueta="Motivo"
            marcador="Por ejemplo: fiesta patronal"
            valor={edicion.motivo}
            alCambiar={(motivo) => setEdicion({ ...edicion, motivo })}
            maximoCaracteres={300}
          />
        ) : null}
        {edicion.misa === "si" ? (
          <>
            <Text style={[tipografia.nota, estilos.suave]}>
              Ventana de la misa. Déjala vacía para usar la del ciclo (07:30 a 09:30).
            </Text>
            <CampoTexto etiqueta="Desde" marcador="07:30" valor={edicion.inicio} alCambiar={(inicio) => setEdicion({ ...edicion, inicio })} maximoCaracteres={5} />
            <CampoTexto etiqueta="Hasta" marcador="09:30" valor={edicion.fin} alCambiar={(fin) => setEdicion({ ...edicion, fin })} maximoCaracteres={5} />
          </>
        ) : null}
        <Aviso tono="informativo" mensaje="En una sesión sin realizar no se cuentan ausencias." />
        {error ? <Aviso tono="error" mensaje={error} /> : null}
        <Boton etiqueta="Guardar cambio" alPresionar={guardar} />
        <Boton etiqueta="Cancelar" variante="enlace" alPresionar={() => setEdicion(null)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.cuerpo, estilos.suave]}>
        Marca un domingo sin misa o sin catequesis. No se cuentan ausencias en esa sesión.
      </Text>
      {guardado ? <Aviso tono="informativo" mensaje={guardado} /> : null}
      {!conConexion ? (
        <Insignia texto="Sin conexión: el cambio se envía al volver la señal" tono="advertencia" />
      ) : null}
      {domingos.length === 0 ? (
        <Tarjeta>
          <Text style={[tipografia.cuerpo, estilos.suave]}>
            Todavía no hay domingos descargados. Conéctate para bajarlos.
          </Text>
        </Tarjeta>
      ) : null}
      <View style={estilos.lista}>
        {domingos.map((domingo) => {
          const porEnviar = sesiones.some((sesion) => sesion.fecha === domingo.fecha && sesion.porEnviar);
          return (
            <FilaNavegacion
              key={domingo.fecha}
              titulo={fechaLarga(domingo.fecha)}
              subtitulo={porEnviar ? "Cambio por enviar" : undefined}
              alPresionar={() => abrir(domingo.fecha)}
              derecha={
                <View style={estilos.insignias}>
                  {domingo.misa ? (
                    <Insignia texto={domingo.misa.cancelada ? "Sin misa" : "Misa"} tono={domingo.misa.cancelada ? "error" : "solido"} />
                  ) : null}
                  {domingo.catequesis ? (
                    <Insignia
                      texto={domingo.catequesis.cancelada ? "Sin catequesis" : "Catequesis"}
                      tono={domingo.catequesis.cancelada ? "error" : "solido"}
                    />
                  ) : null}
                </View>
              }
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  lista: { gap: espacio.s },
  insignias: { alignItems: "flex-end", gap: espacio.xs },
});
