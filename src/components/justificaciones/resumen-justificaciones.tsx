import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso, FilaNavegacion, Insignia, type TonoInsignia } from '@/components/ui';
import type { Evidencia } from '@/lib/justificaciones/cliente-justificaciones';
import { ETIQUETAS_ESTADO, etiquetaFecha, etiquetaSesiones } from '@/lib/justificaciones/presentacion';
import type { AusenciaRef, EstadoVisible } from '@/lib/justificaciones/tipos';
import { useConexion } from '@/plataforma/justificaciones/usar-conexion';
import { colores, espacio, tipografia } from '@/tema';

import { VisorEvidencia } from './visor-evidencia';

/** Una fila de `justificaciones_estado`: solo el estado, nunca causa ni evidencia (D-408). */
export type EstadoJustificacion = Pick<AusenciaRef, 'sesionId' | 'fecha' | 'tipoSesion'> & { id: string; estado: EstadoVisible };

export interface PropiedadesResumenJustificaciones {
  estados: readonly EstadoJustificacion[];
  /** Sin esta función el perfil solo muestra estados: quien no puede ver la evidencia no ve el detalle. */
  obtenerEvidencia?: (justificacionId: string) => Promise<Evidencia>;
}

const TONO: Record<EstadoVisible, TonoInsignia> = { pendiente: 'advertencia', aprobada: 'solido', rechazada: 'error', sin_efecto: 'neutro' };
export const AVISO_DETALLE_SIN_CONEXION = 'El detalle y la evidencia necesitan conexión.';

/** El estado se lee del almacén local y funciona sin red; el detalle se pide en línea (RF-410, RNF-405). */
export function ResumenJustificaciones({ estados, obtenerEvidencia }: PropiedadesResumenJustificaciones) {
  const conectado = useConexion();
  const [abierta, setAbierta] = useState<string | null>(null);
  if (!estados.length) return <Text style={[tipografia.nota, estilos.suave]}>Sin justificaciones en este ciclo.</Text>;
  const ordenados = [...estados].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.tipoSesion.localeCompare(b.tipoSesion));
  return (
    <View style={estilos.lista}>
      {obtenerEvidencia && conectado === false ? <Aviso tono="advertencia" mensaje={AVISO_DETALLE_SIN_CONEXION} /> : null}
      {ordenados.map((fila) => (
        <View key={fila.id} style={estilos.fila}>
          <FilaNavegacion
            titulo={`${etiquetaSesiones([fila])} · ${etiquetaFecha(fila.fecha)}`}
            derecha={<Insignia texto={ETIQUETAS_ESTADO[fila.estado]} tono={TONO[fila.estado]} />}
            alPresionar={obtenerEvidencia ? () => setAbierta(abierta === fila.id ? null : fila.id) : undefined}
            bloqueada={Boolean(obtenerEvidencia) && conectado !== true}
          />
          {obtenerEvidencia && abierta === fila.id && conectado === true ? <VisorEvidencia justificacionId={fila.id} obtener={obtenerEvidencia} /> : null}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.s },
  fila: { gap: espacio.s },
  suave: { color: colores.textoSuave },
});
