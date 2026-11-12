import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { Aviso, Boton, CampoTexto } from "@/components/ui";
import { PLAZO_MAXIMO_DIAS, PLAZO_MINIMO_DIAS } from "@/lib/justificaciones/plazo";
import { AVISO_SIN_CONEXION } from "@/lib/justificaciones/presentacion";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useApiJustificaciones } from "@/plataforma/justificaciones/usar-api";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

/** Días desde la ausencia para justificarla; se define al inicio del ciclo (RF-405). */
export default function PlazoJustificacion() {
  const { apiCatequizandos } = useSesion();
  const api = useApiJustificaciones();
  const conectado = useConexion();
  const cargar = useCallback(async () => {
    const ciclo = await apiCatequizandos.cicloAbierto();
    if (!ciclo) throw Object.assign(new Error("sin_ciclo"), { codigo: "sin_ciclo" });
    return api.obtenerPlazo(ciclo.id);
  }, [api, apiCatequizandos]);
  const { datos, error, cargando, recargar } = useCarga(cargar, conectado === true);
  const [dias, setDias] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ tono: "informativo" | "error"; mensaje: string } | null>(null);
  const valor = dias ?? (datos ? String(datos.diasPlazo) : "");
  const numero = Number(valor);
  const valido = Number.isInteger(numero) && numero >= PLAZO_MINIMO_DIAS && numero <= PLAZO_MAXIMO_DIAS;

  const guardar = async () => {
    if (!datos || !valido || conectado !== true) return;
    setGuardando(true);
    try {
      await api.definirPlazo(datos.cicloId, numero);
      setResultado({ tono: "informativo", mensaje: `Plazo guardado: ${numero} días desde cada ausencia.` });
      setDias(null);
      recargar();
    } catch {
      setResultado({ tono: "error", mensaje: "No se guardó. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setGuardando(false);
    }
  };

  if (conectado === false) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={tipografia.titulo}>Plazo para justificar</Text>
      {cargando ? <Text style={[tipografia.cuerpo, estilos.suave]}>Cargando el plazo…</Text> : null}
      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {datos ? (
        <Text style={[tipografia.cuerpo, estilos.suave]}>
          {datos.predeterminado ? `Plazo vigente: ${datos.diasPlazo} días (predeterminado, aún no definido).` : `Plazo vigente: ${datos.diasPlazo} días.`}
        </Text>
      ) : null}
      <CampoTexto
        etiqueta="Días desde la ausencia"
        valor={valor}
        alCambiar={setDias}
        teclado="number-pad"
        maximoCaracteres={2}
        error={valor && !valido ? `Entre ${PLAZO_MINIMO_DIAS} y ${PLAZO_MAXIMO_DIAS} días.` : undefined}
      />
      {resultado ? <Aviso tono={resultado.tono} mensaje={resultado.mensaje} /> : null}
      <Boton etiqueta="Guardar plazo" alPresionar={() => void guardar()} cargando={guardando} deshabilitado={!datos || !valido} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  suave: { color: colores.textoSuave },
});
