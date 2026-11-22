import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { rechazadosDeLaCuenta, textoMotivo } from "@/lib/asistencia/estado-lista";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

type NinoLocal = { id: string; nombres: string; apellidos: string };

const TIPO_REGISTRO: Record<string, string> = { escaneo: "Escaneo", manual: "Manual", lista: "Lista" };

/**
 * Por enviar (APP-32): lo que espera la señal, la última sincronización y lo
 * que el servidor no aceptó, con su motivo (RF-303, RF-307, A-312).
 */
export default function Pendientes() {
  const { contexto } = useSesion();
  const { conConexion, almacen, pendientes, ultimaSincronizacion, sincronizando, error, sincronizarAhora } =
    useAsistencia();

  const ninos = filasDe(almacen, "catequizandos") as unknown as NinoLocal[];
  const nombreDe = (id: string | null) => {
    const nino = ninos.find((fila) => fila.id === id);
    return nino ? `${nino.nombres} ${nino.apellidos}` : id ? "Niño" : "Carné por validar";
  };
  const grupoDe = (id: string | null) => {
    const grupo = id ? almacen.colecciones.grupos?.[id] : undefined;
    return grupo?.nombre ? String(grupo.nombre) : "Grupo";
  };

  const rechazados = contexto ? rechazadosDeLaCuenta(almacen, contexto.cuentaId) : [];
  const resumen = almacen.ultimoResumen;
  // Las marcas de una lista viajan con ella: se muestran como una sola fila.
  const marcasSueltas = almacen.pendientes.marcas.filter((marca) => !marca.fila.lista_id);

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
          Se envían solos cuando vuelve la conexión. Reenviar no los duplica.
        </Text>
      </View>

      <View style={estilos.lista}>
        {almacen.pendientes.listas.map((lista) => (
          <FilaNavegacion
            key={lista.id}
            titulo={`Lista de ${grupoDe(lista.fila.grupo_id)}`}
            subtitulo={`${lista.fila.total_presentes} presentes · ${lista.fila.total_ausentes} ausentes`}
          />
        ))}
        {marcasSueltas.map((marca) => (
          <FilaNavegacion
            key={marca.id}
            titulo={nombreDe(marca.fila.catequizando_id)}
            subtitulo={`${marca.fila.valor === "presente" ? "Presente" : "Ausente"} · ${
              TIPO_REGISTRO[marca.fila.tipo_registro] ?? marca.fila.tipo_registro
            }`}
          />
        ))}
        {almacen.pendientes.correcciones.map((correccion) => (
          <FilaNavegacion
            key={correccion.id}
            titulo={nombreDe(correccion.fila.catequizando_id)}
            subtitulo={`Corrección a ${correccion.fila.valor_nuevo === "presente" ? "presente" : "ausente"}`}
          />
        ))}
        {almacen.pendientes.sesiones.map((sesion) => (
          <FilaNavegacion
            key={sesion.id}
            titulo={`Domingo ${sesion.fila.fecha}`}
            subtitulo={sesion.fila.cancelada ? `Sin ${sesion.fila.tipo}` : `Ventana de ${sesion.fila.tipo}`}
          />
        ))}
      </View>

      {resumen && resumen.descartadosCierre > 0 ? (
        <Aviso
          tono="advertencia"
          mensaje={`${resumen.descartadosCierre} ${
            resumen.descartadosCierre === 1 ? "registro llegó" : "registros llegaron"
          } después del cierre del ciclo y no se guardaron.`}
        />
      ) : null}

      {rechazados.length > 0 ? (
        <>
          <Text style={[tipografia.encabezado, estilos.tituloSeccion]}>No aceptados</Text>
          <Text style={[tipografia.nota, estilos.suave]}>
            El servidor los guardó como rechazados y avisó a la coordinación.
          </Text>
          <View style={estilos.lista}>
            {rechazados.map((rechazado) => (
              <FilaNavegacion
                key={rechazado.id}
                titulo={rechazado.tipo === "lista" ? "Lista" : nombreDe(rechazado.catequizandoId)}
                subtitulo={textoMotivo(rechazado.motivo)}
                derecha={<Insignia texto="Rechazado" tono="error" />}
              />
            ))}
          </View>
        </>
      ) : null}

      <Boton
        etiqueta="Sincronizar ahora"
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
  bloque: { gap: espacio.s },
  tituloSeccion: { color: colores.primario },
  nota: { color: colores.textoTenue, textAlign: "center" },
  suave: { color: colores.textoSuave },
  lista: { gap: espacio.s },
});
