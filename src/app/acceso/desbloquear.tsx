import { useCallback, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, Insignia, Tarjeta } from "@/components/ui";
import { PuntosPin, TecladoPin } from "@/components/seguridad/teclado-pin";
import { DIAS_SESION_SIN_CONEXION, estadoSesionLocal } from "@/lib/seguridad/sesion-local";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const DIA = 86_400_000;

type Pantalla = "entrar" | "requiere_conexion" | "bloqueada";

/** Dias que quedan para registrar sin volver a renovar la sesion. */
export function diasRestantes(ultimaRenovacion: number | null, ahora: number): number {
  if (!ultimaRenovacion) return 0;
  const transcurridos = Math.floor((ahora - ultimaRenovacion) / DIA);
  return Math.max(0, DIAS_SESION_SIN_CONEXION - transcurridos);
}

export default function Desbloquear() {
  const { gestor, contexto, ultimaRenovacion, bloqueada, intentosFallidos, cargando, cerrarSesion } = useSesion();
  const [pantalla, setPantalla] = useState<Pantalla | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cuentaId = contexto?.cuentaId ?? "";
  const [ahora] = useState(() => Date.now());
  const dias = diasRestantes(ultimaRenovacion, ahora);

  const local = estadoSesionLocal({
    ahoraDispositivo: ahora,
    instanteMaximoVisto: ahora,
    ultimaRenovacion: ultimaRenovacion ?? 0,
    intentosFallidos,
    bloqueada,
  });

  const actual: Pantalla =
    pantalla ??
    (bloqueada || local === "bloqueada"
      ? "bloqueada"
      : local === "requiere-conexion"
        ? "requiere_conexion"
        : "entrar");

  const entrar = useCallback(async () => {
    if (!cuentaId) return;
    setError(null);
    const resultado = await gestor.desbloquear(cuentaId, pin);
    if (resultado.estado === "operativa") {
      router.replace("/");
      return;
    }
    if (resultado.estado === "requiere-conexion") {
      setPantalla("requiere_conexion");
      return;
    }
    if (resultado.estado === "bloqueada") {
      setPantalla("bloqueada");
      return;
    }
    const restantes = Math.max(0, 5 - resultado.intentosFallidos);
    setError(`El PIN no es correcto. Te quedan ${restantes} intentos.`);
  }, [cuentaId, gestor, pin]);

  if (cargando) {
    return (
      <Marco>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Abriendo tu sesión…</Text>
      </Marco>
    );
  }

  if (actual === "bloqueada") {
    return (
      <Marco>
        <View style={estilos.iconoBloqueo}>
          <Text style={estilos.glifo}>🔒</Text>
        </View>
        <Text style={[tipografia.titulo, estilos.titulo]}>Este celular quedó bloqueado</Text>
        <Text style={[tipografia.cuerpo, estilos.texto]}>
          Ingresaste un PIN incorrecto 5 veces seguidas. Por seguridad, la app borró el acceso de este
          celular.
        </Text>
        <Tarjeta>
          <Text style={[tipografia.cuerpoFuerte, estilos.negrita]}>Qué hacer</Text>
          <Text style={[tipografia.cuerpo, estilos.texto]}>
            Pide un enlace nuevo a la coordinación y dile tu seudónimo. Cuando lo recibas, ábrelo en este
            celular.
          </Text>
        </Tarjeta>
        <Boton etiqueta="Entendido" alPresionar={() => router.replace("/")} />
      </Marco>
    );
  }

  if (actual === "requiere_conexion") {
    return (
      <Marco>
        <Aviso
          tono="advertencia"
          mensaje="Pasaron más de 14 días sin conectarte a internet. Conéctate una vez a datos o wifi y podrás volver a pasar lista."
        />
        <Text style={[tipografia.encabezado, estilos.titulo]}>Conéctate para seguir registrando</Text>
        <Tarjeta>
          <Text style={[tipografia.cuerpoFuerte, estilos.negrita]}>Mientras tanto puedes consultar</Text>
          <Text style={[tipografia.cuerpo, estilos.texto]}>
            Verás lo que ya estaba sincronizado, pero no podrás registrar asistencia nueva.
          </Text>
        </Tarjeta>
        <Boton etiqueta="Reintentar conexión" alPresionar={() => setPantalla("entrar")} />
        <Boton etiqueta="Abrir en modo consulta" variante="secundario" alPresionar={() => router.replace("/")} />
      </Marco>
    );
  }

  return (
    <Marco>
      <Text style={[tipografia.cuerpo, estilos.saludo]}>Hola</Text>
      <Text style={[tipografia.titulo, estilos.titulo]}>Ingresa tu PIN</Text>
      <Insignia texto={`Te quedan ${dias} días sin conexión`} tono="suave" />

      <View style={estilos.puntos}>
        <PuntosPin valor={pin} />
      </View>

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}

      <TecladoPin valor={pin} alCambiar={setPin} />

      <Boton etiqueta="Continuar" alPresionar={() => void entrar()} />

      <Boton
        etiqueta="Cambiar de cuenta"
        variante="enlace"
        alPresionar={() => {
          cerrarSesion();
          router.replace("/");
        }}
      />
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.centro}>{children}</View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl },
  centro: { flex: 1, justifyContent: "center", gap: espacio.l },
  saludo: { color: colores.textoSuave },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  negrita: { color: colores.texto },
  puntos: { alignItems: "center", marginVertical: espacio.l },
  error: { color: colores.errorTexto },
  iconoBloqueo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colores.errorFondo,
    alignItems: "center",
    justifyContent: "center",
  },
  glifo: { fontSize: 28 },
});
