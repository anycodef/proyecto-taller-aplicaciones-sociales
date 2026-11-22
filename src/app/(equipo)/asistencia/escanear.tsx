import { useMemo, useRef, useState } from "react";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router, useIsFocused, useLocalSearchParams, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, Vibration, View } from "react-native";

import { ConfirmacionEscaneo } from "@/components/asistencia/confirmacion-escaneo";
import { Aviso, Boton, Insignia } from "@/components/ui";
import { resolverCarne } from "@/lib/asistencia/carne";
import {
  confirmacionDe,
  idMarcaEscaneo,
  lecturaRepetida,
  procesarEscaneo,
  type ConfirmacionDeEscaneo,
} from "@/lib/asistencia/escaneo";
import { marcaALocal } from "@/lib/asistencia/pendientes";
import { fechaEnLima } from "@/lib/asistencia/reloj";
import { aSesion, elegirSesion, ventanaDe } from "@/lib/asistencia/sesiones";
import type { MarcaAsistencia, NinoNomina, ValorAsistencia } from "@/lib/asistencia/tipos";
import { filasDe } from "@/lib/sincronizacion/almacen-local";
import { useAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useInstante } from "@/plataforma/asistencia/use-instante";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, radio, tipografia } from "@/tema";

/** Lo que se espera a validarCarne antes de guardar el escaneo como pendiente. */
const ESPERA_VALIDACION_MS = 1500;
/** El banner se ve lo justo para leerlo de reojo y vuelve la camara. */
const MS_BANNER = 1800;

type Confirmacion = { estado: ConfirmacionDeEscaneo; nombre: string | null; hora: string | null };

function horaCorta(instante: number): string {
  const lima = new Date(instante - 5 * 60 * 60 * 1000);
  return `${lima.getUTCHours()}:${String(lima.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Misa en curso: el escaneo escribe la marca en el celular y confirma al
 * instante; el envio va aparte (RF-302, RNF-302). Solo un carné ausente de la
 * nomina local se consulta al servidor, y solo con red.
 */
export default function Escanear({ ahora }: { ahora?: number }) {
  const { contexto, cliente } = useSesion();
  const { almacen, conConexion, repositorio, pendientes, sincronizarAhora } = useAsistencia();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [linterna, setLinterna] = useState(false);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const ultimaLectura = useRef<{ codigo: string; en: number } | null>(null);
  const enfocada = useIsFocused();
  const reloj = useInstante();
  const instante = ahora ?? reloj;

  const parametros = useLocalSearchParams<{ sesionId?: string | string[] }>();
  const sesionIdPedida = Array.isArray(parametros?.sesionId) ? parametros.sesionId[0] : parametros?.sesionId;

  const cicloId = useMemo(() => {
    const grupos = filasDe(almacen, "grupos");
    const propio = grupos.find((grupo) => contexto?.gruposAsignados.includes(grupo.id));
    return String((propio ?? grupos[0])?.ciclo_id ?? "");
  }, [almacen, contexto]);

  const sesion = useMemo(
    () =>
      elegirSesion(filasDe(almacen, "sesiones").map((fila) => aSesion(fila)), {
        cicloId,
        fecha: fechaEnLima(instante),
        tipo: "misa",
        sesionId: sesionIdPedida ?? null,
      }),
    [almacen, cicloId, instante, sesionIdPedida]
  );

  const nomina = useMemo<NinoNomina[]>(
    () =>
      filasDe(almacen, "catequizandos").map((fila) => ({
        id: String(fila.id),
        nombres: String(fila.nombres),
        apellidos: String(fila.apellidos),
        grupoId: String(fila.grupo_id),
        codigoCarne: fila.codigo_carne ? String(fila.codigo_carne) : null,
        activo: fila.activo !== false,
      })),
    [almacen]
  );

  // Lo ya registrado en esta misa, enviado o no: un segundo escaneo responde
  // «Ya estaba registrado» y no crea otra marca.
  const existentes = useMemo<MarcaAsistencia[]>(() => {
    if (!sesion) return [];
    const pendientesLocales = almacen.pendientes.marcas.map((marca) => marca.fila);
    const enviadas = filasDe(almacen, "marcas_asistencia");
    return ([...pendientesLocales, ...enviadas] as Record<string, unknown>[])
      .filter((fila) => fila.sesion_id === sesion.id)
      .map((fila) => ({
        id: String(fila.id),
        cicloId: String(fila.ciclo_id),
        sesionId: String(fila.sesion_id),
        catequizandoId: fila.catequizando_id ? String(fila.catequizando_id) : null,
        codigoLeido: fila.codigo_leido ? String(fila.codigo_leido) : null,
        valor: fila.valor as ValorAsistencia,
        tipoRegistro: "escaneo",
        registradoPor: String(fila.registrado_por),
        credencialId: String(fila.credencial_id),
        dispositivoId: String(fila.dispositivo_id),
        horaDispositivo: String(fila.hora_dispositivo),
        desfaseRelojMs: Number(fila.desfase_reloj_ms ?? 0),
        estado: fila.estado === "rechazada" ? "rechazada" : "pendiente",
      }));
  }, [almacen, sesion]);

  const registrados = useMemo(() => {
    const ninos = new Set<string>();
    for (const marca of existentes) {
      if (marca.estado !== "rechazada" && marca.valor === "presente") ninos.add(marca.catequizandoId ?? marca.id);
    }
    return ninos.size;
  }, [existentes]);

  const mostrar = (nueva: Confirmacion) => {
    setConfirmacion(nueva);
    setTimeout(() => setConfirmacion(null), MS_BANNER);
  };

  /** Solo con red y con un carné que la nomina local no conoce. */
  const validarEnServidor = async (codigo: string): Promise<boolean> => {
    try {
      const respuesta = await Promise.race([
        cliente.solicitar<{ estado: string }>(
          "GET",
          `/asistencia/carnes/${encodeURIComponent(codigo)}/validacion`
        ),
        new Promise<null>((resolver) => setTimeout(() => resolver(null), ESPERA_VALIDACION_MS)),
      ]);
      // Sin respuesta a tiempo, el escaneo queda pendiente y se valida al sincronizar.
      return respuesta === null || respuesta.estado === "valido";
    } catch {
      return true;
    }
  };

  const alLeer = async ({ data }: BarcodeScanningResult) => {
    const leidoEn = ahora ?? Date.now();
    if (lecturaRepetida(ultimaLectura.current, data, leidoEn)) return;
    ultimaLectura.current = { codigo: data, en: leidoEn };
    if (!sesion || !contexto) return;

    const carne = resolverCarne(data, nomina);
    let conRed = conConexion;
    if (conConexion && carne.estado === "desconocido") {
      // La nomina local puede estar atrasada: si el servidor lo reconoce, se
      // guarda pendiente de validar en vez de rechazarlo.
      const valido = await validarEnServidor(data);
      conRed = !valido;
    }

    const resultado = procesarEscaneo({
      cuenta: contexto,
      sesion,
      codigo: data,
      nomina,
      conConexion: conRed,
      existentes,
      id: idMarcaEscaneo(sesion.id, carne.nino?.id ?? null, data),
      horaDispositivo: new Date(leidoEn).toISOString(),
      desfaseRelojMs: 0,
    });

    if (resultado.marca) repositorio.registrarMarca(marcaALocal(resultado.marca));
    const estado = confirmacionDe(resultado);
    Vibration.vibrate(estado === "registrado" || estado === "otro_grupo" ? 60 : [0, 120, 80, 120]);
    mostrar({
      estado,
      nombre: resultado.mostrarNombre && carne.nino ? `${carne.nino.nombres} ${carne.nino.apellidos}` : null,
      hora: horaCorta(leidoEn),
    });
    // El envio no bloquea la confirmacion.
    if (resultado.marca && conConexion) void sincronizarAhora();
  };

  const cierre = sesion ? horaCorta(ventanaDe(sesion).fin) : null;

  return (
    <View style={estilos.pantalla}>
      <View style={estilos.header}>
        <Text style={[tipografia.titulo, estilos.titulo]}>Misa en curso</Text>
        {sesion ? <Text style={[tipografia.nota, estilos.suave]}>Domingo {sesion.fecha}</Text> : null}
      </View>

      {!sesion ? (
        <Aviso tono="advertencia" mensaje="No hay una misa hoy. El escáner se usa durante la ventana de misa." />
      ) : null}

      <View style={estilos.visor}>
        {confirmacion && confirmacion.estado !== "fuera_de_ventana" ? (
          <ConfirmacionEscaneo estado={confirmacion.estado} nombre={confirmacion.nombre} hora={confirmacion.hora} />
        ) : !permiso ? (
          <Text style={[tipografia.cuerpo, estilos.textoVisor]}>Preparando la cámara…</Text>
        ) : !permiso.granted ? (
          <View style={estilos.permiso}>
            <Text style={[tipografia.cuerpo, estilos.textoVisor]}>
              Para escanear carnés, SIGECAT necesita usar la cámara.
            </Text>
            <Boton etiqueta="Permitir cámara" alPresionar={() => void pedirPermiso()} />
          </View>
        ) : (
          <>
            {/* La camara se desmonta al perder el foco: solo puede haber una activa. */}
            {enfocada ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={linterna}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={sesion ? (lectura) => void alLeer(lectura) : undefined}
              />
            ) : null}
            <Text style={[tipografia.cuerpo, estilos.textoVisor]}>Apunta al código del carné</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={linterna ? "Apagar linterna" : "Encender linterna"}
              accessibilityState={{ selected: linterna }}
              onPress={() => setLinterna((valor) => !valor)}
              style={estilos.linterna}
            >
              <Text style={tipografia.cuerpoFuerte}>{linterna ? "Luz sí" : "Luz"}</Text>
            </Pressable>
          </>
        )}
      </View>

      {confirmacion?.estado === "fuera_de_ventana" ? (
        <Aviso tono="advertencia" mensaje="Fuera de la ventana de misa. No se registró." />
      ) : null}

      <View style={estilos.resumen}>
        <Text style={[tipografia.encabezado, estilos.titulo]}>
          {registrados} {registrados === 1 ? "niño registrado" : "niños registrados"}
        </Text>
        {pendientes.total > 0 ? <Insignia texto={`${pendientes.total} por enviar`} tono="advertencia" /> : null}
      </View>

      <View style={estilos.pie}>
        <Boton
          etiqueta="Registrar a mano"
          variante="secundario"
          alPresionar={() => router.push("/asistencia/manual" as Href)}
        />
        {cierre ? (
          <Text style={[tipografia.nota, estilos.suave, estilos.centrado]}>
            La ventana de misa cierra a las {cierre}.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  header: { gap: espacio.xs },
  titulo: { color: colores.texto },
  suave: { color: colores.textoSuave },
  centrado: { textAlign: "center" },
  visor: {
    aspectRatio: 1,
    borderRadius: radio.tarjeta,
    overflow: "hidden",
    backgroundColor: colores.texto,
    alignItems: "center",
    justifyContent: "center",
  },
  textoVisor: { color: colores.primarioTexto, textAlign: "center", padding: espacio.l },
  permiso: { gap: espacio.m, padding: espacio.l },
  linterna: {
    position: "absolute",
    right: espacio.l,
    bottom: espacio.l,
    backgroundColor: colores.superficie,
    borderRadius: radio.boton,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
  },
  resumen: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.s },
  pie: { marginTop: "auto", gap: espacio.s },
});
