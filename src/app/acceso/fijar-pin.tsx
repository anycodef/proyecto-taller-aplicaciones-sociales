import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { IndicadorPasos, Boton } from "@/components/ui";
import { PuntosPin, TecladoPin } from "@/components/seguridad/teclado-pin";
import { validarFormatoPin } from "@/lib/seguridad/pin";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

type Fase = "crear" | "confirmar";

export default function FijarPin() {
  const { gestor, activacion, iniciarSesion } = useSesion();
  const [fase, setFase] = useState<Fase>("crear");
  const [pin, setPin] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!activacion) router.replace("/");
  }, [activacion]);

  const escribir = (valor: string) => {
    setError(null);
    if (fase === "crear") setPin(valor);
    else setConfirmacion(valor);
  };

  const continuar = async () => {
    if (fase === "crear") {
      if (!validarFormatoPin(pin)) {
        setError("El PIN debe tener de 4 a 6 dígitos.");
        return;
      }
      setFase("confirmar");
      setConfirmacion("");
      return;
    }

    if (!validarFormatoPin(confirmacion)) {
      setError("El PIN debe tener de 4 a 6 dígitos.");
      return;
    }
    if (pin !== confirmacion) {
      setError("Los dos PIN no son iguales.");
      return;
    }
    if (!activacion) return;

    setGuardando(true);
    try {
      await gestor.fijarPin(activacion, pin);
      iniciarSesion("equipo", activacion.contexto, activacion.jwt);
      setGuardando(false);
      router.replace("/");
    } catch {
      setGuardando(false);
      setError("No pudimos guardar tu PIN en este celular.");
    }
  };

  const valorActual = fase === "crear" ? pin : confirmacion;

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <IndicadorPasos actual={fase === "crear" ? 1 : 2} total={2} />
      <Text style={[tipografia.titulo, estilos.titulo]}>
        {fase === "crear" ? "Crea tu PIN" : "Repite tu PIN"}
      </Text>
      <Text style={[tipografia.cuerpo, estilos.texto]}>
        {fase === "crear"
          ? "De 4 a 6 dígitos. Lo usarás cada vez que abras la app. Se queda solo en este celular."
          : "Escribe los mismos dígitos para confirmar."}
      </Text>

      <View style={estilos.puntos}>
        <PuntosPin valor={valorActual} />
      </View>

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}

      <TecladoPin valor={valorActual} alCambiar={escribir} />

      <Boton
        etiqueta={fase === "crear" ? "Continuar" : "Guardar PIN"}
        alPresionar={() => void continuar()}
        cargando={guardando}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  puntos: { alignItems: "center", marginVertical: espacio.l },
  error: { color: colores.errorTexto },
});
