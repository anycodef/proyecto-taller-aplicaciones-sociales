import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FilaNino } from "@/components/asistencia/fila-nino";
import { Aviso, Boton, Insignia } from "@/components/ui";
import { crearMarca } from "@/lib/asistencia/pendientes";
import type { ValorAsistencia } from "@/lib/asistencia/tipos";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
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

export default function ListaCatequesis({ grupoId }: { grupoId: string }) {
  const { contexto } = useSesion();
  const { almacen, conConexion, registrarMarca, sincronizarAhora, sincronizando } = useAsistencia();
  const [valores, setValores] = useState<Record<string, ValorAsistencia>>({});
  const [confirmado, setConfirmado] = useState(false);

  const ninos: NinoLocal[] = useMemo(
    () =>
      filasDe(almacen, "catequizandos").filter(
        (fila) => fila.grupo_id === grupoId && fila.activo !== false
      ) as unknown as NinoLocal[],
    [almacen, grupoId]
  );

  const grupo = filasDe(almacen, "grupos").find((fila) => fila.id === grupoId) as
    | { nombre?: string }
    | undefined;

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
    const sesion = filasDe(almacen, "sesiones")[0] as
      | { id: string; ciclo_id: string; fecha: string }
      | undefined;
    if (!sesion || !contexto) return;

    for (const nino of ninos) {
      registrarMarca(
        crearMarca({
          sesionId: sesion.id,
          cicloId: sesion.ciclo_id,
          catequizandoId: nino.id,
          valor: valorDe(nino.id),
          tipoRegistro: "lista",
          listaId: null,
          registradoPor: contexto.cuentaId,
          cuentaId: contexto.cuentaId,
          credencialId: contexto.credencialId,
          dispositivoId: contexto.dispositivoId ?? "",
          horaDispositivo: new Date().toISOString(),
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
      </View>

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
        deshabilitado={ninos.length === 0}
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
  lista: { gap: espacio.s },
});
