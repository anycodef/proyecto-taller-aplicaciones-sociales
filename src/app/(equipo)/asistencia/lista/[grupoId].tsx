import { useCallback, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FilaNino } from "@/components/asistencia/fila-nino";
import { Aviso, Boton, Insignia } from "@/components/ui";
import { crearMarca } from "@/lib/asistencia/pendientes";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import { aSesion, elegirSesion } from "@/lib/asistencia/sesiones";
import type { ValorAsistencia } from "@/lib/asistencia/tipos";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useInstante } from "@/plataforma/asistencia/use-instante";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

type NinoLocal = {
  id: string;
  nombres: string;
  apellidos: string;
  grupo_id: string;
  codigo_carne: string | null;
  activo: boolean;
};

type GrupoLocal = {
  id: string;
  nombre?: string;
  ciclo_id?: string;
};

export default function ListaCatequesis({
  grupoId,
  ahora,
}: {
  grupoId: string;
  /** Reloj inyectable: en produccion es el del celular. */
  ahora?: number;
}) {
  const { contexto } = useSesion();
  const { almacen, conConexion, registrarMarca, sincronizarAhora, sincronizando } = useAsistencia();
  const [valores, setValores] = useState<Record<string, ValorAsistencia>>({});
  const [confirmado, setConfirmado] = useState(false);
  const reloj = useInstante();
  const instante = ahora ?? reloj;

  const parametros = useLocalSearchParams<{ sesionId?: string | string[] }>();
  const sesionIdPedida = useMemo(() => {
    const pedida = parametros?.sesionId;
    if (Array.isArray(pedida)) return pedida[0] ?? null;
    return pedida ?? null;
  }, [parametros]);

  const ninos: NinoLocal[] = useMemo(
    () =>
      filasDe(almacen, "catequizandos").filter(
        (fila) => fila.grupo_id === grupoId && fila.activo !== false
      ) as unknown as NinoLocal[],
    [almacen, grupoId]
  );

  const grupo = filasDe(almacen, "grupos").find((fila) => fila.id === grupoId) as
    | GrupoLocal
    | undefined;

  // La sesion nunca es la primera descargada: es la del ciclo del grupo, de la
  // fecha de hoy y del tipo catequesis. Con ?sesionId se registra sobre esa.
  const sesion = useMemo(() => {
    const sesiones = filasDe(almacen, "sesiones").map((fila) => aSesion(fila));
    return elegirSesion(sesiones, {
      cicloId: grupo?.ciclo_id ?? "",
      fecha: fechaEnLima(instante),
      tipo: "catequesis",
      sesionId: sesionIdPedida,
    });
  }, [almacen, grupo?.ciclo_id, instante, sesionIdPedida]);

  const valorDe = useCallback(
    (ninoId: string): ValorAsistencia => valores[ninoId] ?? "presente",
    [valores]
  );

  const alternar = (ninoId: string) => {
    setConfirmado(false);
    setValores((actuales) => ({
      ...actuales,
      [ninoId]: valorDe(ninoId) === "presente" ? "ausente" : "presente",
    }));
  };

  const confirmar = async () => {
    if (!sesion || !contexto) return;

    for (const nino of ninos) {
      registrarMarca(
        crearMarca({
          sesionId: sesion.id,
          cicloId: sesion.cicloId,
          catequizandoId: nino.id,
          valor: valorDe(nino.id),
          tipoRegistro: "lista",
          listaId: null,
          registradoPor: contexto.cuentaId,
          cuentaId: contexto.cuentaId,
          credencialId: contexto.credencialId,
          dispositivoId: contexto.dispositivoId ?? "",
          horaDispositivo: new Date(instante).toISOString(),
          desfaseRelojMs: 0,
        })
      );
    }
    setConfirmado(true);
    if (conConexion) await sincronizarAhora();
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.header}>
        <Text style={[tipografia.titulo, estilos.titulo]}>
          {grupo?.nombre ?? "Lista de catequesis"}
        </Text>
        <Insignia
          texto={conConexion ? "Conectado" : "Sin conexión"}
          tono={conConexion ? "solido" : "advertencia"}
        />
        {sesion ? (
          <Text style={[tipografia.nota, estilos.nota]}>Sesión del {sesion.fecha}</Text>
        ) : null}
      </View>

      {!sesion ? (
        <Aviso tono="informativo" mensaje="Hoy no hay catequesis de este grupo." />
      ) : null}

      {!conConexion ? (
        <Aviso
          tono="advertencia"
          mensaje="Sin conexión. La lista se guarda en el celular y se envía al volver la red."
        />
      ) : null}

      {confirmado ? (
        <Aviso tono="informativo" mensaje="Lista guardada en el celular." />
      ) : null}

      <View style={estilos.lista}>
        {ninos.map((nino) => (
          <FilaNino
            key={nino.id}
            nombres={nino.nombres}
            apellidos={nino.apellidos}
            valor={valorDe(nino.id)}
            onAlternar={() => alternar(nino.id)}
          />
        ))}
      </View>

      {ninos.length === 0 ? (
        <Aviso
          tono="informativo"
          mensaje="No hay niños en este grupo todavía. Conéctate para bajar la nómina."
        />
      ) : null}

      <Boton
        etiqueta="Confirmar lista"
        alPresionar={() => void confirmar()}
        cargando={sincronizando}
        deshabilitado={ninos.length === 0 || !sesion}
      />
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
  header: { gap: espacio.s },
  titulo: { color: colores.texto },
  nota: { color: colores.textoTenue },
  lista: { gap: espacio.s },
});
