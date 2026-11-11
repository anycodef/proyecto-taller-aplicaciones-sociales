import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, CampoTexto, FilaNavegacion, Insignia } from "@/components/ui";
import { buscarNinosPorNombre, procesarRegistroManual } from "@/lib/asistencia/manual";
import { marcaALocal } from "@/lib/asistencia/pendientes";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import { aSesion, elegirSesion } from "@/lib/asistencia/sesiones";
import type { MarcaAsistencia } from "@/lib/asistencia/tipos";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useInstante } from "@/plataforma/asistencia/use-instante";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export default function RegistroManual({ ahora }: { ahora?: number }) {
  const { contexto } = useSesion();
  const { almacen, repositorio } = useAsistencia();
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reloj = useInstante();
  const instante = ahora ?? reloj;

  const parametros = useLocalSearchParams<{ sesionId?: string | string[] }>();
  const sesionIdPedida = useMemo(() => {
    const pedida = parametros?.sesionId;
    if (Array.isArray(pedida)) return pedida[0] ?? null;
    return pedida ?? null;
  }, [parametros]);

  // El ciclo se toma del grupo del catequista: la pantalla solo conoce el
  // ciclo que le corresponde.
  const cicloId = useMemo(() => {
    const grupos = almacen.colecciones.grupos ?? {};
    for (const grupoId of contexto?.gruposAsignados ?? []) {
      const grupo = grupos[grupoId];
      if (grupo?.ciclo_id) return String(grupo.ciclo_id);
    }
    const primero = Object.values(grupos)[0];
    return primero?.ciclo_id ? String(primero.ciclo_id) : "";
  }, [almacen, contexto]);

  const sesion = useMemo(() => {
    const sesiones = almacen.colecciones.sesiones
      ? Object.values(almacen.colecciones.sesiones).map((fila) => aSesion(fila))
      : [];
    return elegirSesion(sesiones, {
      cicloId,
      fecha: fechaEnLima(instante),
      tipo: "misa",
      sesionId: sesionIdPedida,
    });
  }, [almacen, cicloId, instante, sesionIdPedida]);

  // Solo los ninos de los grupos del catequista: es lo que permite registrar
  // a mano (RF-304).
  const ninos = useMemo(
    () => buscarNinosPorNombre(repositorio.ninosDeGrupos(contexto?.gruposAsignados ?? []), busqueda),
    [repositorio, contexto, busqueda]
  );

  const registrados = useMemo(() => {
    const ids = new Set<string>();
    for (const marca of almacen.pendientes.marcas) {
      if (marca.fila.tipo_registro !== "manual") continue;
      if (sesion && marca.fila.sesion_id !== sesion.id) continue;
      if (marca.fila.catequizando_id) ids.add(marca.fila.catequizando_id);
    }
    return ids;
  }, [almacen, sesion]);

  const existentes = useMemo<MarcaAsistencia[]>(
    () =>
      almacen.pendientes.marcas
        .filter((marca) => (sesion ? marca.fila.sesion_id === sesion.id : true))
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
          estado: "pendiente",
        })),
    [almacen, sesion]
  );

  const registrar = (ninoId: string) => {
    if (!sesion || !contexto) return;
    const nino = repositorio.ninosDeGrupos(contexto.gruposAsignados).find((fila) => fila.id === ninoId);
    if (!nino) return;
    setError(null);
    const resultado = procesarRegistroManual({
      cuenta: contexto,
      sesion,
      nino,
      existentes,
      horaDispositivo: new Date(instante).toISOString(),
      desfaseRelojMs: 0,
    });
    if (resultado.resultado !== "registrado" || !resultado.marca) {
      setError(
        resultado.resultado === "fuera_de_alcance"
          ? "Solo puedes registrar a niños de tus grupos."
          : resultado.resultado === "ya_registrado"
            ? "Ese niño ya está registrado en esta misa."
            : "Fuera de la ventana de misa."
      );
      return;
    }
    repositorio.registrarMarca(marcaALocal(resultado.marca));
  };

  const nombreDe = (grupoId: string) => {
    const grupo = almacen.colecciones.grupos?.[grupoId];
    return grupo && grupo.nombre ? String(grupo.nombre) : "Grupo";
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Registro manual</Text>

      <CampoTexto
        etiqueta="Buscar niño"
        marcador="Nombre o apellido"
        valor={busqueda}
        alCambiar={setBusqueda}
      />

      <Aviso
        tono="informativo"
        mensaje="Solo aparecen niños de tus grupos. Al registrar, vuelves al escáner."
      />

      {error ? <Aviso tono="error" mensaje={error} /> : null}

      {!sesion ? (
        <Aviso tono="advertencia" mensaje="No hay una misa en curso. Registra durante la ventana de misa." />
      ) : null}

      <View style={estilos.lista}>
        {ninos.map((nino) => {
          const registrado = registrados.has(nino.id);
          return (
            <FilaNavegacion
              key={nino.id}
              titulo={`${nino.nombres} ${nino.apellidos}`}
              subtitulo={nombreDe(nino.grupoId)}
              derecha={
                registrado ? (
                  <Insignia texto="Registrado" tono="solido" />
                ) : (
                  <Boton
                    etiqueta="Registrar"
                    variante="secundario"
                    alPresionar={() => registrar(nino.id)}
                  />
                )
              }
            />
          );
        })}
      </View>

      {ninos.length === 0 ? (
        <Aviso tono="informativo" mensaje="No hay niños que coincidan con la búsqueda." />
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
  lista: { gap: espacio.s },
});
