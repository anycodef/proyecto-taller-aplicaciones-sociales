import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/ui';
import type { Evidencia } from '@/lib/justificaciones/cliente-justificaciones';
import { AVISO_SIN_CONEXION } from '@/lib/justificaciones/presentacion';
import { useConexion } from '@/plataforma/justificaciones/usar-conexion';
import { colores, espacio, radio, tipografia } from '@/tema';

export interface PropiedadesVisorEvidencia {
  justificacionId: string;
  /** Pide una SAS nueva cada vez que se abre: la URL caduca en 5 minutos. */
  obtener: (justificacionId: string) => Promise<Evidencia>;
}

/** Sin caché en disco ni memoria: la evidencia nunca queda en el celular (RNF-101, D-410). */
export function VisorEvidencia({ justificacionId, obtener }: PropiedadesVisorEvidencia) {
  const conectado = useConexion();
  // Se guarda con su id: al cambiar de justificación no se muestra la evidencia anterior.
  const [abierta, setAbierta] = useState<{ id: string; evidencia: Evidencia } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    if (conectado !== true) return;
    let vigente = true;
    obtener(justificacionId)
      .then((resultado) => { if (vigente) setAbierta({ id: justificacionId, evidencia: resultado }); })
      .catch((error: unknown) => {
        if (!vigente) return;
        const codigo = error && typeof error === 'object' && 'codigo' in error ? String((error as { codigo: unknown }).codigo) : '';
        setFallo(codigo === 'sin_evidencia' ? 'La evidencia ya no está disponible: se eliminó por retiro del consentimiento o retención.' : 'No pudimos abrir la evidencia.');
      });
    return () => { vigente = false; };
  }, [conectado, justificacionId, obtener]);

  if (conectado === false) return <Aviso tono="advertencia" mensaje={AVISO_SIN_CONEXION} />;
  if (fallo) return <Aviso tono="error" mensaje={fallo} />;
  const evidencia = abierta?.id === justificacionId ? abierta.evidencia : null;
  if (!evidencia) return <Text style={[tipografia.nota, estilos.suave]}>Abriendo la evidencia…</Text>;
  return (
    <View style={estilos.fotos}>
      {evidencia.archivos.map((archivo) => (
        <Image
          key={archivo.orden}
          source={{ uri: archivo.url }}
          cachePolicy="none"
          contentFit="contain"
          style={estilos.foto}
          accessibilityLabel={`Evidencia, foto ${archivo.orden}`}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fotos: { gap: espacio.m },
  foto: { width: '100%', aspectRatio: 3 / 4, borderRadius: radio.tarjeta, backgroundColor: colores.neutroFondo },
  suave: { color: colores.textoSuave },
});
