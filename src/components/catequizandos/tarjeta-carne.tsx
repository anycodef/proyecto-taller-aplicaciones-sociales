import { StyleSheet, Text, View } from "react-native";

import { CodigoQr } from "./codigo-qr";
import { colores, espacio, radio, tipografia } from "@/tema";

export type PropsTarjetaCarne = {
  nombres: string;
  apellidos: string;
  grupo: string;
  emision: number;
  codigoCarne: string;
};

/** Carné del niño: seudónimo, grupo, QR y número de emisión. */
export function TarjetaCarne({ nombres, apellidos, grupo, emision, codigoCarne }: PropsTarjetaCarne) {
  return (
    <View style={estilos.carne}>
      <Text style={[tipografia.etiqueta, estilos.marca]}>SIGECAT · CARNÉ</Text>
      <Text style={[tipografia.encabezado, estilos.nombre]}>
        {nombres} {apellidos}
      </Text>
      <Text style={[tipografia.cuerpo, estilos.grupo]}>{grupo}</Text>
      <View style={estilos.qr}>
        <CodigoQr codigo={codigoCarne} lado={190} />
      </View>
      <Text style={[tipografia.cuerpo, estilos.emision]}>Emisión {emision}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  carne: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.tarjeta,
    padding: espacio.xl,
    gap: espacio.s,
    alignItems: "center",
  },
  marca: { color: colores.primario, letterSpacing: 1, textTransform: "uppercase" },
  nombre: { color: colores.texto, textAlign: "center" },
  grupo: { color: colores.textoSuave },
  qr: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.campo,
    padding: espacio.m,
    marginVertical: espacio.m,
  },
  emision: { color: colores.textoSuave },
});
