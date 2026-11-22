import { useMemo, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FilaNino } from "@/components/asistencia/fila-nino";
import { Aviso, Boton, FilaNavegacion, Insignia, PantallaResultado } from "@/components/ui";
import { confirmarListaEnLocal } from "@/lib/asistencia/confirmar-lista";
import { borradorGuardado, listaConfirmadaLocal, textoMotivo } from "@/lib/asistencia/estado-lista";
import { abrirLista, alternar, type BorradorLista } from "@/lib/asistencia/lista";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import { idBorradorLista } from "@/lib/asistencia/repositorio-asistencia";
import { aSesion, elegirSesion } from "@/lib/asistencia/sesiones";
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

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default function ListaCatequesis({
  grupoId: grupoIdProp,
  ahora,
}: {
  grupoId: string;
  /** Reloj inyectable: en produccion es el del celular. */
  ahora?: number;
}) {
  const { contexto } = useSesion();
  const { almacen, conConexion, repositorio, sincronizarAhora } = useAsistencia();
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reloj = useInstante();
  const instante = ahora ?? reloj;

  // El identificador del grupo llega como prop de la ruta; en el navegador se
  // lee tambien de los parametros de navegacion.
  const parametros = useLocalSearchParams<{ grupoId?: string | string[]; sesionId?: string | string[] }>();
  const grupoId = primero(parametros?.grupoId) ?? grupoIdProp;
  const sesionIdPedida = primero(parametros?.sesionId) ?? null;

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

  const borradorId = sesion ? idBorradorLista(sesion.id, grupoId) : null;
  const confirmada = sesion ? listaConfirmadaLocal(almacen, sesion.id, grupoId) : null;

  // Cada toque queda en el celular: cerrar la app o perder la batería no
  // borra lo marcado (RF-306). Los ninos que nadie toco van presentes. Se lee
  // en cada render porque cada toque guardado cambia el almacen y redibuja.
  const borrador: BorradorLista = abrirLista(ninos);
  const guardado = borradorId ? borradorGuardado(almacen, borradorId) : null;
  for (const [ninoId, valor] of Object.entries(guardado ?? {})) {
    if (ninoId in borrador) borrador[ninoId] = valor;
  }

  const alAlternar = (ninoId: string) => {
    if (!borradorId) return;
    repositorio.guardarBorrador(borradorId, alternar(borrador, ninoId));
  };

  const confirmar = () => {
    if (!sesion || !contexto) return;
    setError(null);
    const hora = new Date(instante).toISOString();
    try {
      confirmarListaEnLocal({
        repositorio,
        cuenta: contexto,
        sesion,
        grupoId,
        borrador,
        abiertaEn: hora,
        hora,
        desfaseRelojMs: 0,
      });
      // La lista ya esta en el celular; el envio va aparte y no se espera.
      if (conConexion) void sincronizarAhora();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No pudimos guardar la lista.");
    }
  };

  const nombreGrupo = grupo?.nombre ?? "este grupo";

  if (sesion && confirmada && !corrigiendo) {
    return (
      <PantallaResultado
        tono={confirmada.rechazada ? "error" : "exito"}
        icono={
          <Text style={[estilos.icono, confirmada.rechazada ? estilos.iconoError : null]}>
            {confirmada.rechazada ? "!" : "✓"}
          </Text>
        }
        titulo={confirmada.rechazada ? "Lista no aceptada" : "Lista confirmada"}
        mensaje={`${confirmada.totalPresentes} ${confirmada.totalPresentes === 1 ? "presente" : "presentes"} y ${
          confirmada.totalAusentes
        } ${confirmada.totalAusentes === 1 ? "ausente" : "ausentes"} en ${nombreGrupo}.`}
        acciones={
          <>
            <Boton etiqueta="Volver al inicio" alPresionar={() => router.replace("/asistencia" as Href)} />
            {confirmada.rechazada ? null : (
              <Boton etiqueta="Corregir a alguien" variante="secundario" alPresionar={() => setCorrigiendo(true)} />
            )}
            <Boton
              etiqueta="Pasar lista de otro grupo"
              variante="secundario"
              alPresionar={() => router.replace("/asistencia" as Href)}
            />
          </>
        }
      >
        <View style={estilos.insignia}>
          {confirmada.rechazada ? (
            <Insignia texto={textoMotivo(confirmada.motivoRechazo ?? "")} tono="error" />
          ) : confirmada.porEnviar ? (
            <Insignia texto="Se enviará cuando vuelva la señal" tono="advertencia" />
          ) : (
            <Insignia texto="Enviada" tono="solido" />
          )}
        </View>
      </PantallaResultado>
    );
  }

  if (sesion && confirmada && corrigiendo) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.titulo, estilos.titulo]}>Corregir a alguien</Text>
        <Aviso
          tono="informativo"
          mensaje="La lista ya está confirmada. Toca al niño cuya asistencia quieres corregir."
        />
        <View style={estilos.lista}>
          {ninos.map((nino) => {
            const valor = confirmada.valores[nino.id];
            return (
              <FilaNavegacion
                key={nino.id}
                titulo={`${nino.nombres} ${nino.apellidos}`}
                subtitulo={valor === "ausente" ? "Ausente" : valor === "presente" ? "Presente" : "Sin registro"}
                alPresionar={() =>
                  router.push(`/asistencia/correccion/${sesion.id}/${nino.id}` as Href)
                }
              />
            );
          })}
        </View>
        <Boton etiqueta="Volver" variante="enlace" alPresionar={() => setCorrigiendo(false)} />
      </ScrollView>
    );
  }

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
          <Text style={[tipografia.nota, estilos.nota]}>
            Sesión del {sesion.fecha} · todos empiezan presentes; toca a quien faltó.
          </Text>
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

      {error ? <Aviso tono="error" mensaje={error} /> : null}

      <View style={estilos.lista}>
        {ninos.map((nino) => (
          <FilaNino
            key={nino.id}
            nombres={nino.nombres}
            apellidos={nino.apellidos}
            valor={borrador[nino.id] ?? "presente"}
            onAlternar={() => alAlternar(nino.id)}
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
        alPresionar={confirmar}
        deshabilitado={ninos.length === 0 || !sesion}
      />
      <Boton
        etiqueta="Volver"
        variante="enlace"
        alPresionar={() => router.replace("/asistencia" as Href)}
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
  icono: { ...tipografia.titulo, color: colores.primarioTexto },
  iconoError: { color: colores.errorTexto },
  insignia: { flexDirection: "row" },
});
