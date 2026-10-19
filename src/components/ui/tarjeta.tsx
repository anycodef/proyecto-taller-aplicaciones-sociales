import { colores, espacio, radio } from '@/tema';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export type TonoTarjeta = 'neutra' | 'advertencia' | 'primaria';

export interface PropiedadesTarjeta {
  tono?: TonoTarjeta;
  seleccionada?: boolean;
  children: ReactNode;
}

export function Tarjeta({ tono = 'neutra', seleccionada = false, children }: PropiedadesTarjeta) {
  return (
    <View
      style={[
        estilos.base,
        tono === 'advertencia' ? estilos.advertencia : null,
        tono === 'primaria' ? estilos.primaria : null,
        seleccionada ? estilos.seleccionada : null,
      ]}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.tarjeta,
    padding: espacio.l,
    gap: espacio.s,
  },
  advertencia: { backgroundColor: colores.advertenciaFondo, borderColor: colores.advertenciaFondo },
  primaria: { backgroundColor: colores.primarioSuave, borderColor: colores.primarioSuave },
  seleccionada: { borderWidth: 2, borderColor: colores.primario, backgroundColor: colores.primarioSuave },
});
