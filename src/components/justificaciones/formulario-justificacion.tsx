import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SelectorAusencias } from "@/components/justificaciones/selector-ausencias";
import { SelectorCausa } from "@/components/justificaciones/selector-causa";
import { Aviso, Boton } from "@/components/ui";
import { ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";
import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { MAXIMO_FOTOS } from "@/lib/justificaciones/evidencia";
import type { FilaAusencias } from "@/lib/justificaciones/justificables";
import { AVISO_SIN_CONEXION, etiquetaFecha, etiquetaSesiones } from "@/lib/justificaciones/presentacion";
import type { AusenciaRef, Causa } from "@/lib/justificaciones/tipos";
import { marcarBandejaDesactualizada } from "@/plataforma/justificaciones/bandeja-vigente";
import type { ImagenLocal } from "@/plataforma/justificaciones/comprimir-foto";
import { crearBorrador, enviarJustificacion, ErrorEnvio, type Borrador } from "@/plataforma/justificaciones/enviar-justificacion";
import { useConexion } from "@/plataforma/justificaciones/usar-conexion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, radio, tipografia } from "@/tema";

export const claveDeFila = (fila: FilaAusencias) => `${fila.catequizandoId}|${fila.fecha}|${fila.ausencias[0].sesionId}`;

export type PropiedadesFormularioJustificacion = {
  titulo: string;
  /** Filas que la familia puede marcar; quien llama decide si son pasadas o futuras. */
  filas: FilaAusencias[];
  nombres: Map<string, string>;
  marcadasAlInicio: string[];
  causas: readonly Causa[];
  anticipada: boolean;
  textoFoto: string;
  /** La coordinación registra en nombre de este apoderado; sin él, envía la familia. */
  apoderadoId?: string;
  /** Ruta de confirmación; por defecto la de la familia. */
  rutaEnviada?: "/familia/enviada" | "/coordinacion/justificaciones";
};

/** Una sola pantalla: ausencias, causa, foto y Enviar (RNF-401). La foto nunca se guarda (RNF-404). */
export function FormularioJustificacion({ titulo, filas, nombres, marcadasAlInicio, causas, anticipada, textoFoto, apoderadoId, rutaEnviada = "/familia/enviada" }: PropiedadesFormularioJustificacion) {
  const { cliente } = useSesion();
  const api = useMemo(() => crearClienteJustificaciones(cliente), [cliente]);
  const conectado = useConexion();
  const [marcadas, setMarcadas] = useState<string[]>(marcadasAlInicio);
  const [causa, setCausa] = useState<Causa | null>(causas.length === 1 ? causas[0] : null);
  const [fotos, setFotos] = useState<ImagenLocal[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const borrador = useRef<Borrador | null>(null);

  const opciones = filas.map((fila) => ({
    clave: claveDeFila(fila),
    titulo: `${nombres.get(fila.catequizandoId) ?? "Su hijo"} · ${etiquetaFecha(fila.fecha)}`,
    detalle: etiquetaSesiones(fila.ausencias),
  }));
  const elegidas: AusenciaRef[] = filas.filter((f) => marcadas.includes(claveDeFila(f))).flatMap((f) => f.ausencias);

  const agregarFoto = async (desdeCamara: boolean) => {
    setAviso(null);
    const resultado = desdeCamara
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (resultado.canceled) return;
    const nuevas = resultado.assets.map((a) => ({ uri: a.uri, ancho: a.width, alto: a.height }));
    setFotos((actuales) => [...actuales, ...nuevas].slice(0, MAXIMO_FOTOS));
  };

  const enviar = async () => {
    if (!causa || !fotos.length || !elegidas.length) return;
    setEnviando(true);
    setAviso(null);
    borrador.current ??= crearBorrador();
    try {
      const { lote } = await enviarJustificacion({ borrador: borrador.current, causa, ausencias: elegidas.map((a) => ({ ...a, anticipada })), fotos, ...(apoderadoId ? { apoderadoId } : {}) }, { cliente: api });
      const resumen = lote.justificaciones.map((j) => `${nombres.get(j.catequizandoId) ?? "Su hijo"} · ${etiquetaFecha(j.fecha)} · ${etiquetaSesiones([j])}`);
      marcarBandejaDesactualizada();
      if (rutaEnviada === "/familia/enviada") router.replace({ pathname: "/familia/enviada", params: { resumen: JSON.stringify(resumen) } });
      else router.replace(rutaEnviada);
    } catch (fallo) {
      if (fallo instanceof ErrorEnvio) {
        borrador.current = (fallo as ErrorEnvio & { borrador?: Borrador }).borrador ?? borrador.current;
        setAviso(fallo.mensajeVisible);
      } else setAviso(AVISO_SIN_CONEXION);
      // La foto ya se borró del celular: hay que volver a tomarla para reintentar.
      setFotos([]);
    } finally {
      setEnviando(false);
    }
  };

  if (conectado === false) {
    return (
      <View style={estilos.contenido}>
        <Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={tipografia.titulo}>{titulo}</Text>

      <Paso numero={1} titulo={anticipada ? "¿Qué sesiones va a faltar?" : "¿Qué ausencias cubre el comprobante?"}>
        {filas.length > 1 ? <Text style={[tipografia.nota, estilos.suave]}>Marca todas las que cubre, también las de tus otros hijos.</Text> : null}
        {filas.length ? <SelectorAusencias opciones={opciones} seleccionadas={marcadas} alCambiar={setMarcadas} /> : <Text style={tipografia.cuerpo}>No hay sesiones para elegir.</Text>}
      </Paso>

      <Paso numero={2} titulo="¿Por qué faltó?">
        <SelectorCausa etiqueta={null} causas={causas.map((c) => ({ valor: c, etiqueta: ETIQUETAS_CAUSA[c] }))} valor={causa} alCambiar={(c) => setCausa(c as Causa)} />
      </Paso>

      <Paso numero={3} titulo={textoFoto}>
        <Text style={[tipografia.nota, estilos.suave]}>{`Hasta ${MAXIMO_FOTOS} fotos. No se guardan en el celular.`}</Text>
        {fotos.length ? (
          <View style={estilos.fotos}>
            {fotos.map((foto) => (
              <Image key={foto.uri} source={{ uri: foto.uri }} cachePolicy="none" style={estilos.foto} accessibilityLabel="Foto del comprobante" />
            ))}
          </View>
        ) : null}
        {fotos.length < MAXIMO_FOTOS ? (
          <View style={estilos.botones}>
            <Boton etiqueta={fotos.length ? "Agregar otra foto" : "Tomar foto"} variante="secundario" alPresionar={() => void agregarFoto(true)} />
            <Boton etiqueta="Elegir de la galería" variante="enlace" alPresionar={() => void agregarFoto(false)} />
          </View>
        ) : null}
      </Paso>

      {aviso ? <Aviso tono="error" mensaje={aviso} /> : null}
      {elegidas.length ? (
        <Text style={[tipografia.nota, estilos.suave, estilos.centrado]}>
          {elegidas.length === 1 ? "Se enviará 1 justificación." : `Se enviarán ${elegidas.length} justificaciones con la misma foto.`}
        </Text>
      ) : null}
      <Boton etiqueta="Enviar" alPresionar={() => void enviar()} cargando={enviando} deshabilitado={!causa || !fotos.length || !elegidas.length} />
    </ScrollView>
  );
}

/** Encabezado numerado de cada paso: el orden se lee sin instrucciones (RNF-401). */
function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.paso}>
      <View style={estilos.cabeceraPaso}>
        <View style={estilos.numero}>
          <Text style={[tipografia.etiqueta, estilos.numeroTexto]}>{numero}</Text>
        </View>
        <Text style={[tipografia.cuerpoFuerte, estilos.flex]}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  paso: { gap: espacio.s },
  cabeceraPaso: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  numero: { width: espacio.xl, height: espacio.xl, borderRadius: espacio.xl / 2, backgroundColor: colores.primario, alignItems: "center", justifyContent: "center" },
  numeroTexto: { color: colores.primarioTexto },
  flex: { flex: 1 },
  centrado: { textAlign: "center" },
  contenido: { padding: espacio.xl, gap: espacio.l, backgroundColor: colores.fondo },
  suave: { color: colores.textoSuave },
  fotos: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s },
  foto: { width: espacio.xxl * 3, height: espacio.xxl * 4, borderRadius: radio.campo, backgroundColor: colores.neutroFondo },
  botones: { gap: espacio.s },
});
