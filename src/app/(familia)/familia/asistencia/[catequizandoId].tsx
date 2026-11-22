import { useCallback, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta, type TonoInsignia } from "@/components/ui";
import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { etiquetaFecha } from "@/lib/justificaciones/presentacion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

type EstadoSesion = "presente" | "ausente" | "sin_registro" | "pendiente" | "no_aplica" | string;
type ResumenDomingos = {
  domingos: { fecha: string; misa: EstadoSesion; catequesis: EstadoSesion }[];
  ausencias: number;
  faltas: number;
};

const ESTADOS: Record<string, { texto: string; tono: TonoInsignia }> = {
  presente: { texto: "Presente", tono: "solido" },
  ausente: { texto: "Ausente", tono: "error" },
  sin_registro: { texto: "Sin registro", tono: "neutro" },
  pendiente: { texto: "Por registrar", tono: "neutro" },
  no_aplica: { texto: "No aplica", tono: "neutro" },
};
const estadoDe = (estado: EstadoSesion) => ESTADOS[estado] ?? ESTADOS.sin_registro;

/**
 * Asistencia de mi hijo (WEB-10): por domingo, presente o ausente en misa y
 * en catequesis. Solo lectura y en línea; a la familia no se le muestra quién
 * registró ni a qué hora (HU-306, A-313).
 */
export default function AsistenciaDeMiHijo({ catequizandoId: idProp }: { catequizandoId?: string }) {
  const { cliente } = useSesion();
  const conectado = useConexion();
  const parametros = useLocalSearchParams<{ catequizandoId?: string | string[] }>();
  const catequizandoId =
    (Array.isArray(parametros?.catequizandoId) ? parametros.catequizandoId[0] : parametros?.catequizandoId) ?? idProp ?? "";
  const justificaciones = useMemo(() => crearClienteJustificaciones(cliente), [cliente]);

  const cargar = useCallback(async () => {
    const [resumen, justificables] = await Promise.all([
      cliente.solicitar<ResumenDomingos>("GET", `/asistencia/catequizandos/${catequizandoId}/domingos`),
      justificaciones.ausenciasJustificables().catch(() => null),
    ]);
    const nino = justificables?.ninos.find((fila) => fila.catequizandoId === catequizandoId);
    return { resumen, nombre: nino?.nombres ?? null };
  }, [cliente, justificaciones, catequizandoId]);
  const { datos, error, cargando, recargar } = useCarga(cargar, conectado === true && Boolean(catequizandoId));

  if (conectado === false) {
    return (
      <View style={estilos.contenido}>
        <Aviso tono="advertencia" mensaje="Sin conexión. La asistencia se consulta en línea y nada se guarda en este celular." />
      </View>
    );
  }

  const domingos = [...(datos?.resumen.domingos ?? [])].reverse();
  const hayAusencias = domingos.some((domingo) => domingo.misa === "ausente" || domingo.catequesis === "ausente");

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.cabecera}>
        <Text style={[tipografia.titulo, estilos.flex]}>
          {datos?.nombre ? `Asistencia de ${datos.nombre}` : "Asistencia"}
        </Text>
        <Insignia texto="En línea" tono="suave" />
      </View>
      {cargando && !datos ? <Text style={[tipografia.cuerpo, estilos.suave]}>Buscando la asistencia…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {error ? <Boton etiqueta="Reintentar" variante="secundario" alPresionar={recargar} /> : null}
      {datos ? (
        <Tarjeta>
          <Text style={[tipografia.nota, estilos.suave]}>Faltas del ciclo</Text>
          <Text style={tipografia.titulo}>{`${datos.resumen.faltas} ${datos.resumen.faltas === 1 ? "falta" : "faltas"}`}</Text>
          <Text style={[tipografia.nota, estilos.suave]}>
            Una falta es faltar a misa y a catequesis el mismo domingo, sin justificar.
          </Text>
        </Tarjeta>
      ) : null}
      {datos && domingos.length === 0 ? (
        <Text style={[tipografia.cuerpo, estilos.suave]}>Aún no hay domingos registrados.</Text>
      ) : null}
      <View style={estilos.lista}>
        {domingos.map((domingo) => (
          <Tarjeta key={domingo.fecha}>
            <Text style={tipografia.cuerpoFuerte}>{etiquetaFecha(domingo.fecha)}</Text>
            <View style={estilos.sesiones}>
              <Text style={[tipografia.nota, estilos.suave]}>Misa</Text>
              <Insignia texto={estadoDe(domingo.misa).texto} tono={estadoDe(domingo.misa).tono} />
              <Text style={[tipografia.nota, estilos.suave]}>Catequesis</Text>
              <Insignia texto={estadoDe(domingo.catequesis).texto} tono={estadoDe(domingo.catequesis).tono} />
            </View>
          </Tarjeta>
        ))}
      </View>
      {hayAusencias ? (
        <Boton etiqueta="Justificar una ausencia" variante="secundario" alPresionar={() => router.push("/familia")} />
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, padding: espacio.xl, gap: espacio.m, backgroundColor: colores.fondo },
  cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  flex: { flex: 1 },
  lista: { gap: espacio.s },
  sesiones: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: espacio.s, marginTop: espacio.xs },
  suave: { color: colores.textoSuave },
});
