import { useState } from "react";
import { Share, Text } from "react-native";

import { Boton } from "@/components/ui";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export type PropiedadesCompartirEnlace = {
  cuentaId: string;
  tipo: "equipo" | "familia";
  alGenerar?: () => void;
};

/**
 * Genera el enlace y lo comparte con la hoja del sistema. No usa ningun
 * servicio de mensajeria: el enlace viaja por el canal que ya usa la familia.
 */
export function CompartirEnlace({ cuentaId, tipo, alGenerar }: PropiedadesCompartirEnlace) {
  const { api } = useSesion();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const compartir = async () => {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const { url } = await api.emitirEnlace(cuentaId, tipo);
      await Share.share({ message: url, title: "Tu enlace de SIGECAT" });
      setMensaje("Enlace compartido.");
      alGenerar?.();
    } catch {
      setError("No pudimos generar el enlace. Inténtalo otra vez.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Boton
        etiqueta={tipo === "familia" ? "Generar enlace de familia" : "Generar enlace del equipo"}
        alPresionar={() => void compartir()}
        cargando={ocupado}
      />
      {mensaje ? <TextoNota texto={mensaje} /> : null}
      {error ? <TextoNota texto={error} error /> : null}
    </>
  );
}

function TextoNota({ texto, error = false }: { texto: string; error?: boolean }) {
  return (
    <Text
      style={[
        tipografia.nota,
        { color: error ? colores.errorTexto : colores.textoSuave, marginTop: espacio.s },
      ]}
    >
      {texto}
    </Text>
  );
}
