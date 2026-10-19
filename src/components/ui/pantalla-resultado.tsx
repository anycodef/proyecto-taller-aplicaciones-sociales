import { colores, espacio, radio, tipografia } from '@/tema';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type TonoResultado = 'exito' | 'advertencia' | 'error' | 'neutro';

export interface PropiedadesPantallaResultado {
  tono: TonoResultado;
  titulo: string;
  icono: ReactNode;
  mensaje?: string;
  children?: ReactNode;
  acciones?: ReactNode;
}

const fondoDelIcono: Record<TonoResultado, string> = {
  exito: colores.primario,
  advertencia: colores.advertenciaFondo,
  error: colores.errorFondo,
  neutro: colores.primarioSuave,
};

export function PantallaResultado({
  tono,
  titulo,
  icono,
  mensaje,
  children,
  acciones,
}: PropiedadesPantallaResultado) {
  return (
    <View style={estilos.pantalla}>
      <View style={estilos.centro}>
        <View style={[estilos.icono, { backgroundColor: fondoDelIcono[tono] }]}>{icono}</View>
        <Text accessibilityRole="header" style={[tipografia.titulo, estilos.titulo]}>
          {titulo}
        </Text>
        {mensaje ? <Text style={[tipografia.cuerpo, estilos.mensaje]}>{mensaje}</Text> : null}
        {children}
      </View>
      {acciones ? <View style={estilos.acciones}>{acciones}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo, padding: espacio.xl },
  centro: { flex: 1, justifyContent: 'center', gap: espacio.l },
  icono: {
    width: 64,
    height: 64,
    borderRadius: radio.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { color: colores.texto },
  mensaje: { color: colores.textoSuave },
  acciones: { gap: espacio.m },
});
