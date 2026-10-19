import { StyleSheet, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { matrizQr } from "@/lib/catequizandos/carne";
import { colores } from "@/tema";

export type PropiedadesCodigoQr = {
  /** Codigo SGC1 del carné. */
  codigo: string;
  lado?: number;
};

/** Pinta la matriz del QR calculada en el dispositivo, sin pedir nada al servidor. */
export function CodigoQr({ codigo, lado = 180 }: PropiedadesCodigoQr) {
  const matriz = matrizQr(codigo);
  const modulos = matriz.length;

  return (
    <View accessible accessibilityLabel="Código QR del carné" style={estilos.marco}>
      <Svg width={lado} height={lado} viewBox={`0 0 ${modulos} ${modulos}`}>
        <Rect x={0} y={0} width={modulos} height={modulos} fill={colores.superficie} />
        {matriz.map((fila, y) =>
          fila.map((oscuro, x) =>
            oscuro ? (
              <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colores.texto} />
            ) : null
          )
        )}
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { alignItems: "center", justifyContent: "center" },
});
