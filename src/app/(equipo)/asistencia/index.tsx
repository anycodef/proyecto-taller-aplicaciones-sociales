import { useMemo } from "react";
import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { gruposParaLista, reporteDeDomingo, type GrupoLocal } from "@/lib/asistencia/menu-asistencia";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import { aSesion, sesionEnCurso } from "@/lib/asistencia/sesiones";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useInstante } from "@/plataforma/asistencia/use-instante";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export default function MenuAsistencia({ ahora }: { ahora?: number }) {
  const { rolesEfectivos, cerrarSesion } = useSesion();
  const { cargando, conConexion, almacen, pendientes, ultimaSincronizacion, sincronizando, error, sincronizarAhora } =
    useAsistencia();
  const reloj = useInstante();
  const instante = ahora ?? reloj;

  const grupos = useMemo(
    () => gruposParaLista(filasDe(almacen, "grupos") as unknown as GrupoLocal[], filasDe(almacen, "catequizandos")),
    [almacen]
  );
  const enCurso = useMemo(
    () => sesionEnCurso(filasDe(almacen, "sesiones").map((fila) => aSesion(fila)), instante),
    [almacen, instante]
  );
  const coordinacion = rolesEfectivos.includes("coordinacion");
  const verReporte = coordinacion || rolesEfectivos.includes("supervision");
  const catequista = rolesEfectivos.includes("catequista");

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
        <Text style={[tipografia.titulo, estilos.titulo]}>
          {enCurso ? (enCurso.tipo === "misa" ? "Misa en curso" : enCurso.tipo === "catequesis" ? "Catequesis en curso" : "Actividad en curso") : "Asistencia"}
        </Text>
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
      {!enCurso ? (
        <Aviso tono="informativo" mensaje="No hay misa ni catequesis en curso. Puedes revisar lo pendiente o los grupos." />
      ) : null}

      {error ? <Aviso tono="error" mensaje={error} /> : null}

      <View style={estilos.lista}>
        {catequista ? (
          <FilaNavegacion
            titulo="Escanear carnés"
            subtitulo="Misa: un carné, un registro"
            alPresionar={() => router.push("/asistencia/escanear" as Href)}
          />
        ) : null}
        {catequista ? (
          <FilaNavegacion
            titulo="Registrar a mano"
            subtitulo="Cuando el carné no se puede leer"
            alPresionar={() => router.push("/asistencia/manual" as Href)}
          />
        ) : null}
        <FilaNavegacion
          titulo="Por enviar"
          subtitulo={
            pendientes.total > 0
              ? `${pendientes.total} ${pendientes.total === 1 ? "registro" : "registros"} por enviar`
              : "Todo enviado"
          }
          derecha={pendientes.total > 0 ? <Insignia texto={String(pendientes.total)} tono="advertencia" /> : undefined}
          alPresionar={() => router.push("/asistencia/pendientes" as Href)}
        />
      </View>

      <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>Pasar lista de un grupo</Text>
      {grupos.length === 0 ? (
        <Aviso
          tono="informativo"
          mensaje="Todavía no hay grupos descargados. Conéctate para bajar la nómina."
        />
      ) : null}
      <View style={estilos.lista}>
        {grupos.map((grupo) => (
          <FilaNavegacion
            key={grupo.id}
            titulo={grupo.nombre}
            subtitulo={`${grupo.ninos} ${grupo.ninos === 1 ? "niño" : "niños"}${grupo.esMio ? " · tu grupo" : ""}`}
            alPresionar={() => router.push(`/asistencia/lista/${grupo.id}` as Href)}
          />
        ))}
      </View>

      <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>Más</Text>
      <View style={estilos.lista}>
        <FilaNavegacion
          titulo="Catequizandos"
          subtitulo="Tus niños: perfil, asistencia y documentos"
          alPresionar={() => router.push("/mis-catequizandos" as Href)}
        />
        <FilaNavegacion
          titulo="Riesgo de deserción"
          subtitulo="Niños de tus grupos con faltas, y por qué"
          alPresionar={() => router.push("/riesgo" as Href)}
        />
        {coordinacion ? (
          <FilaNavegacion
            titulo="Domingos del ciclo"
            subtitulo="Domingo sin misa o con otra ventana"
            derecha={<Insignia texto="Solo coordinación" tono="neutro" />}
            alPresionar={() => router.push("/coordinacion/sesiones" as Href)}
          />
        ) : null}
        {coordinacion ? (
          <FilaNavegacion
            titulo="Avisos de asistencia"
            subtitulo="Carnés inválidos, conflictos y revisión cruzada"
            bloqueada={!conConexion}
            alPresionar={() => router.push("/coordinacion/avisos-asistencia" as Href)}
          />
        ) : null}
        {verReporte ? (
          <FilaNavegacion
            titulo="Reporte de misa"
            subtitulo="Presentes frente a activos del último domingo"
            bloqueada={!conConexion}
            alPresionar={() => router.push(`/reportes/misa/${reporteDeDomingo(fechaEnLima(instante))}` as Href)}
          />
        ) : null}
        <FilaNavegacion
          titulo="Asistente de catequesis"
          subtitulo="Preguntas de doctrina con fuentes públicas"
          alPresionar={() => router.push("/asistente" as Href)}
        />
        <FilaNavegacion
          titulo="Cerrar sesión"
          subtitulo={
            pendientes.total > 0
              ? "Tus registros por enviar se conservan; la nómina se borra del celular"
              : "La nómina se borra del celular"
          }
          alPresionar={() => {
            cerrarSesion();
            router.replace("/" as Href);
          }}
        />
      </View>

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
