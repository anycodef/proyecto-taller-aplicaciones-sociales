import { useMemo, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, CampoTexto, GrupoOpciones, Insignia, Tarjeta } from "@/components/ui";
import { validarCorreccion } from "@/lib/asistencia/correccion";
import { consolidar } from "@/lib/asistencia/consolidacion";
import { correccionALocal } from "@/lib/asistencia/pendientes";
import { aSesion, finDelDomingo, idCorreccion } from "@/lib/asistencia/sesiones";
import type { Correccion, MarcaAsistencia, ValorAsistencia } from "@/lib/asistencia/tipos";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useInstante } from "@/plataforma/asistencia/use-instante";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const OPCIONES = [
  { valor: "presente", etiqueta: "Presente" },
  { valor: "ausente", etiqueta: "Ausente" },
] as const;

export default function CorregirAsistencia({
  sesionId,
  catequizandoId,
  ahora,
}: {
  sesionId: string;
  catequizandoId: string;
  /** Reloj inyectable: en produccion es el del celular. */
  ahora?: number;
}) {
  const { contexto } = useSesion();
  const { almacen, conConexion, repositorio, sincronizarAhora } = useAsistencia();
  const [valorNuevo, setValorNuevo] = useState<ValorAsistencia>("presente");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const reloj = useInstante();
  const instante = ahora ?? reloj;

  const sesion = useMemo(() => {
    const fila = almacen.colecciones.sesiones?.[sesionId];
    return fila ? aSesion(fila) : null;
  }, [almacen, sesionId]);

  const nino = useMemo(() => {
    const fila = almacen.colecciones.catequizandos?.[catequizandoId];
    if (!fila) return null;
    return {
      id: String(fila.id),
      nombres: String(fila.nombres),
      apellidos: String(fila.apellidos),
      grupoId: String(fila.grupo_id),
    };
  }, [almacen, catequizandoId]);

  const marcas = useMemo<MarcaAsistencia[]>(
    () =>
      almacen.pendientes.marcas
        .filter(
          (marca) =>
            marca.fila.sesion_id === sesionId && marca.fila.catequizando_id === catequizandoId
        )
        .map((marca) => ({
          id: marca.id,
          cicloId: marca.fila.ciclo_id,
          sesionId: marca.fila.sesion_id,
          catequizandoId: marca.fila.catequizando_id,
          valor: marca.fila.valor,
          tipoRegistro: marca.fila.tipo_registro,
          listaId: marca.fila.lista_id,
          registradoPor: marca.fila.registrado_por,
          credencialId: marca.fila.credencial_id,
          dispositivoId: marca.fila.dispositivo_id,
          horaDispositivo: marca.fila.hora_dispositivo,
          desfaseRelojMs: marca.fila.desfase_reloj_ms,
          // En el celular la marca todavia no la acepto el servidor: para ver
          // el valor actual cuenta igual.
          estado: "aceptada",
        })),
    [almacen, sesionId, catequizandoId]
  );

  const consolidado = useMemo(() => consolidar(marcas), [marcas]);
  const autores = consolidado?.registradores ?? [];
  const terminoElDomingo = sesion ? instante > finDelDomingo(sesion.fecha) : false;
  const puedeCorregir =
    Boolean(contexto) &&
    Boolean(sesion) &&
    (terminoElDomingo
      ? contexto?.rolesPropios.includes("coordinacion") === true
      : autores.includes(contexto?.cuentaId ?? "") &&
        contexto?.rolesPropios.includes("catequista") === true);

  const guardar = async () => {
    if (!sesion || !contexto) return;
    if (!contexto.dispositivoId) {
      setError("El dispositivo no está identificado.");
      return;
    }
    setError(null);
    const horaDispositivo = new Date(instante).toISOString();
    const correccion: Correccion = {
      id: idCorreccion(sesion.id, catequizandoId, valorNuevo, horaDispositivo),
      cicloId: sesion.cicloId,
      sesionId: sesion.id,
      catequizandoId,
      valorAnterior: consolidado?.valor ?? "sin_registro",
      valorNuevo,
      motivo: motivo.trim() ? motivo.trim() : null,
      corregidoPor: contexto.cuentaId,
      credencialId: contexto.credencialId,
      horaDispositivo,
      desfaseRelojMs: 0,
      recibidoEn: horaDispositivo,
      estado: "aceptada",
    };
    const motivoError = validarCorreccion(correccion, contexto, autores, sesion.fecha, instante);
    if (terminoElDomingo && !correccion.motivo) {
      setError("Indica el motivo de la corrección.");
      return;
    }
    if (motivoError) {
      setError(
        motivoError === "correccion_no_autorizada"
          ? "No puedes corregir este registro."
          : "La hora de la corrección no es coherente."
      );
      return;
    }
    repositorio.registrarCorreccion(correccionALocal(correccion, contexto.dispositivoId));
    setGuardado(true);
    if (conConexion) await sincronizarAhora();
  };

  if (!sesion || !nino) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Aviso tono="informativo" mensaje="No encontramos ese registro en el celular." />
        <Boton etiqueta="Volver" variante="enlace" alPresionar={() => router.replace("/asistencia" as never)} />
      </ScrollView>
    );
  }

  const hora = consolidado?.horaPrimerRegistro
    ? new Date(consolidado.horaPrimerRegistro).toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Corregir asistencia</Text>

      <Tarjeta>
        <Text style={[tipografia.cuerpoFuerte, estilos.nombre]}>
          {nino.nombres} {nino.apellidos}
        </Text>
        <Text style={[tipografia.nota, estilos.nota]}>
          {sesion.tipo === "misa" ? "Misa" : "Catequesis"} del domingo {sesion.fecha}
        </Text>
      </Tarjeta>

      <View style={estilos.bloque}>
        <Text style={[tipografia.etiqueta, estilos.etiqueta]}>Valor anterior</Text>
        <View style={estilos.fila} testID="valor-anterior">
          <Insignia
            texto={consolidado?.valor === "ausente" ? "Ausente" : "Presente"}
            tono={consolidado?.valor === "ausente" ? "error" : "solido"}
          />
        </View>
        <Text style={[tipografia.nota, estilos.nota]}>
          {hora ? `${hora}, registró ` : "registró "}[catequista]
        </Text>
      </View>

      <GrupoOpciones
        etiqueta="Nuevo valor"
        opciones={OPCIONES}
        valor={valorNuevo}
        alCambiar={(valor) => setValorNuevo(valor as ValorAsistencia)}
      />

      {terminoElDomingo ? (
        <Aviso
          tono="informativo"
          mensaje="Terminó el domingo: solo la coordinación corrige y debe indicar el motivo."
        />
      ) : null}

      {terminoElDomingo ? (
        <CampoTexto
          etiqueta="Motivo"
          marcador="Obligatorio"
          valor={motivo}
          alCambiar={setMotivo}
          maximoCaracteres={300}
        />
      ) : null}

      {error ? <Aviso tono="error" mensaje={error} /> : null}
      {guardado ? <Aviso tono="informativo" mensaje="Corrección guardada en el celular." /> : null}

      {puedeCorregir ? (
        <Boton etiqueta="Guardar corrección" alPresionar={() => void guardar()} />
      ) : null}

      <Boton
        etiqueta="Volver"
        variante="enlace"
        alPresionar={() => router.replace("/asistencia" as never)}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  titulo: { color: colores.texto },
  bloque: { gap: espacio.s },
  fila: { flexDirection: "row", gap: espacio.s },
  etiqueta: { color: colores.textoSuave },
  nombre: { color: colores.texto },
  nota: { color: colores.textoTenue },
});
