import { StyleSheet, Text, View } from "react-native";

import { colores, espacio, radio, tipografia } from "@/tema";

/**
 * Estados de la confirmacion de un escaneo.
 *
 * - `registrado`: el nino es de los grupos propios, se muestra su nombre.
 * - `otro_grupo`: se registro, pero no se muestra el nombre (RNF-307).
 * - `ya_registrado`: ese carné ya se habia escaneado en esta misa.
 * - `invalido`: el carné no se pudo validar.
 */
export type EstadoConfirmacionEscaneo =
  | "registrado"
  | "otro_grupo"
  | "ya_registrado"
  | "invalido";

export type PropiedadesConfirmacionEscaneo = {
  estado: EstadoConfirmacionEscaneo;
  /** Nombre del nino: solo si es de los grupos propios. */
  nombre?: string | null;
  /** Hora del registro, ya en texto ("8:12"). */
  hora?: string | null;
};

type EstiloEstado = {
  fondo: string;
  texto: string;
  glifo: string;
  titulo: (nombre: string | null) => string;
  mensaje: (hora: string | null) => string | null;
};

const estilosPorEstado: Record<EstadoConfirmacionEscaneo, EstiloEstado> = {
  registrado: {
    fondo: colores.primario,
    texto: colores.primarioTexto,
    glifo: "✓",
    titulo: (nombre) => nombre ?? "Registrado",
    mensaje: (hora) => (hora ? `Registrado en misa a las ${hora}` : null),
  },
  otro_grupo: {
    fondo: colores.texto,
    texto: colores.primarioTexto,
    glifo: "✓",
    titulo: () => "Registrado",
    mensaje: () => null,
  },
  ya_registrado: {
    fondo: colores.advertenciaFondo,
    texto: colores.advertenciaTexto,
    glifo: "!",
    titulo: () => "Ya estaba registrado",
    mensaje: () => "Este carné ya se escaneó en esta misa.",
  },
  invalido: {
    fondo: colores.errorFondo,
    texto: colores.errorTexto,
    glifo: "✕",
    titulo: () => "Carné no válido",
    mensaje: () => "No se registró. Sin conexión, se guarda y se valida al sincronizar.",
  },
};

/**
 * Banner de confirmacion del escaneo. Ocupa toda la pantalla para que la
 * catequista lo vea de reojo sin dejar de mirar el carné.
 */
export function ConfirmacionEscaneo({
  estado,
  nombre,
  hora,
}: PropiedadesConfirmacionEscaneo) {
  const estilo = estilosPorEstado[estado];

  return (
    <View
      accessibilityRole="alert"
      style={[estilos.banner, { backgroundColor: estilo.fondo }]}
    >
      <Text style={[estilos.glifo, { color: estilo.texto }]}>{estilo.glifo}</Text>
      <Text style={[estilos.titulo, { color: estilo.texto }]}>
        {estilo.titulo(nombre ?? null)}
      </Text>
      {estilo.mensaje(hora ?? null) ? (
        <Text style={[estilos.mensaje, { color: estilo.texto }]}>
          {estilo.mensaje(hora ?? null)}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  banner: {
    flex: 1,
    borderRadius: radio.tarjeta,
    alignItems: "center",
    justifyContent: "center",
    padding: espacio.xl,
    gap: espacio.m,
  },
  glifo: { fontSize: 48, fontWeight: "300" },
  titulo: { ...tipografia.titulo, textAlign: "center" },
  mensaje: { ...tipografia.cuerpo, textAlign: "center" },
});
