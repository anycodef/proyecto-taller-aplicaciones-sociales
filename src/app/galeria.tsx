import {
  Aviso,
  Boton,
  CampoTexto,
  FilaNavegacion,
  GrupoOpciones,
  IndicadorPasos,
  Insignia,
  PantallaResultado,
  Tarjeta,
} from '@/components/ui';
import { PuntosPin, TecladoPin } from '@/components/seguridad/teclado-pin';
import { CompartirEnlace } from '@/components/seguridad/compartir-enlace';
import { ComponenteConsentimiento } from '@/components/seguridad/consentimiento';
import { TarjetaCarne } from '@/components/catequizandos/tarjeta-carne';
import { ConfirmacionEscaneo } from '@/components/asistencia/confirmacion-escaneo';
import { BurbujaMensaje } from '@/components/asistente/burbuja-mensaje';
import { TarjetaRiesgo } from '@/components/riesgo/tarjeta-riesgo';
import { SelectorAusencias } from '@/components/justificaciones/selector-ausencias';
import { SelectorCausa } from '@/components/justificaciones/selector-causa';
import { TarjetaLote } from '@/components/justificaciones/tarjeta-lote';
import { VisorEvidencia } from '@/components/justificaciones/visor-evidencia';
import type { Causa } from '@/lib/justificaciones/tipos';
import { colores, espacio, tipografia } from '@/tema';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function Galeria() {
  const [verResultado, setVerResultado] = useState(false);
  const [nombre, setNombre] = useState('');
  const [sexo, setSexo] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [seleccionAusencias, setSeleccionAusencias] = useState<ReadonlySet<string>>(new Set(['n1|s1']));
  const [causa, setCausa] = useState<Causa | null>(null);

  if (verResultado) {
    return (
      <PantallaResultado
        tono="error"
        titulo="Este celular quedó bloqueado"
        icono={<Text style={estilos.glifo}>🔒</Text>}
        mensaje="Ingresaste un PIN incorrecto 5 veces seguidas. Por seguridad, la app borró el acceso de este celular."
        acciones={<Boton etiqueta="Entendido" alPresionar={() => setVerResultado(false)} />}
      >
        <Tarjeta>
          <Text style={tipografia.cuerpoFuerte}>Qué hacer</Text>
          <Text style={tipografia.cuerpo}>
            Pide un enlace nuevo a la coordinación y dile tu seudónimo. Cuando lo recibas, ábrelo en
            este celular.
          </Text>
        </Tarjeta>
      </PantallaResultado>
    );
  }

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Galería de componentes</Text>

      <Seccion titulo="Botones">
        <Boton etiqueta="Continuar" alPresionar={() => undefined} />
        <Boton etiqueta="Pegar enlace" variante="secundario" alPresionar={() => undefined} />
        <Boton etiqueta="Pasar lista de otro grupo" variante="enlace" alPresionar={() => undefined} />
        <Boton etiqueta="Continuar" deshabilitado alPresionar={() => undefined} />
        <Boton etiqueta="Reduciendo foto…" cargando alPresionar={() => undefined} />
      </Seccion>

      <Seccion titulo="Insignias">
        <View style={estilos.fila}>
          <Insignia texto="Sugerido" tono="solido" />
          <Insignia texto="Disponible sin conexión" tono="suave" />
          <Insignia texto="3 por enviar" tono="advertencia" />
          <Insignia texto="Ausente" tono="error" />
          <Insignia texto="Requiere conexión" tono="neutro" />
        </View>
      </Seccion>

      <Seccion titulo="Avisos">
        <Aviso tono="advertencia" mensaje="Sin conexión. Mostrando lo guardado en el celular." />
        <Aviso tono="informativo" mensaje="Estos datos se consultan en línea y no se guardan en este celular." />
        <Aviso tono="error" mensaje="No se envió. Vuelve a intentarlo cuando tengas señal." />
      </Seccion>

      <Seccion titulo="Filas de navegación">
        <FilaNavegacion titulo="Mis grupos" alPresionar={() => undefined} />
        <FilaNavegacion
          titulo="Por enviar"
          derecha={<Insignia texto="5" tono="advertencia" />}
          alPresionar={() => undefined}
        />
        <FilaNavegacion titulo="Documentos" subtitulo="Con conexión" bloqueada />
      </Seccion>

      <Seccion titulo="Formulario">
        <IndicadorPasos actual={1} total={4} />
        <CampoTexto etiqueta="Nombres" marcador="Nombres del niño" valor={nombre} alCambiar={setNombre} />
        <GrupoOpciones
          etiqueta="Sexo"
          valor={sexo}
          alCambiar={setSexo}
          opciones={[
            { valor: 'f', etiqueta: 'Femenino' },
            { valor: 'm', etiqueta: 'Masculino' },
          ]}
        />
      </Seccion>

      <Seccion titulo="Pantalla de resultado">
        <Boton etiqueta="Ver pantalla de bloqueo" variante="secundario" alPresionar={() => setVerResultado(true)} />
      </Seccion>

      <Seccion titulo="PIN">
        <PuntosPin valor={pin} />
        <TecladoPin valor={pin} alCambiar={setPin} />
      </Seccion>

      <Seccion titulo="Compartir enlace">
        <Tarjeta>
          <Text style={[tipografia.cuerpoFuerte, { color: colores.texto }]}>Enlace de acceso</Text>
          <Text style={[tipografia.nota, { color: colores.textoSuave }]}>
            Se genera en el servidor y se comparte con la hoja del sistema, sin servicio de mensajería.
          </Text>
          <CompartirEnlace cuentaId="galeria" tipo="equipo" />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Consentimiento">
        <ComponenteConsentimiento
          texto={{
            id: 'texto-ejemplo',
            version: 'v1',
            contenido:
              'Yo, apoderado del catequizando, autorizo el tratamiento de sus datos para formar grupos y preparar los sacramentos. La constancia sacramental se conserva sin vencimiento.',
            contenidoSha256: 'a'.repeat(64),
            incluyeClausulaConstancia: true,
            vigenteDesde: '2026-10-19T12:00:00.000Z',
          }}
          alAceptar={() => undefined}
        />
      </Seccion>

      <Seccion titulo="Carné">
        <TarjetaCarne
          nombres="Mateo Alejandro"
          apellidos="Vargas Mendoza"
          grupo="Grupo A"
          emision={1}
          codigoCarne="SGC1:3f2504e0-4f89-41d3-9a0c-0305e82c3301:1"
        />
      </Seccion>

      <Seccion titulo="Confirmación de escaneo">
        <ConfirmacionEscaneo estado="registrado" nombre="Sebastián André Ramírez Flores" hora="8:12" />
        <ConfirmacionEscaneo estado="otro_grupo" />
        <ConfirmacionEscaneo estado="ya_registrado" />
        <ConfirmacionEscaneo estado="invalido" />
      </Seccion>

      <Seccion titulo="Justificar una ausencia">
        <SelectorAusencias
          ausencias={[
            { catequizandoId: 'n1', nombre: 'Ana Demostración', sesionId: 's1', tipoSesion: 'misa', fecha: '2026-11-08', venceEn: '2026-11-15T23:59:59-05:00' },
            { catequizandoId: 'n1', nombre: 'Ana Demostración', sesionId: 's2', tipoSesion: 'catequesis', fecha: '2026-11-08', venceEn: '2026-11-15T23:59:59-05:00' },
          ]}
          seleccion={seleccionAusencias}
          alAlternar={(clave) => setSeleccionAusencias((actual) => (actual.has(clave) ? new Set([...actual].filter((c) => c !== clave)) : new Set([...actual, clave])))}
        />
        <SelectorCausa valor={causa} alCambiar={setCausa} />
      </Seccion>

      <Seccion titulo="Bandeja de justificaciones">
        <TarjetaLote
          alPresionar={() => undefined}
          lote={{
            loteId: 'lote-1',
            justificaciones: [
              { id: 'j1', catequizandoId: 'n1', nombre: 'Ana Demostración', fecha: '2026-11-08', tipoSesion: 'misa', causa: 'salud_nino', enviadaEn: '2026-11-09T14:00:00.000Z', canal: 'enlace', duplicada: true },
              { id: 'j2', catequizandoId: 'n1', nombre: 'Ana Demostración', fecha: '2026-11-08', tipoSesion: 'catequesis', causa: 'salud_nino', enviadaEn: '2026-11-09T14:00:00.000Z', canal: 'enlace', duplicada: false },
            ],
          }}
        />
      </Seccion>

      <Seccion titulo="Riesgo de deserción">
        <TarjetaRiesgo
          fila={{
            catequizandoId: 'n2', nombre: 'Niño ficticio 2', grupoId: 'g1', grupoNombre: 'Grupo demo', paso: 'alerta_retiro', conteo: 4, sinFicha: true, pendientesJustificar: 0,
            faltasOrigen: [
              { catequizandoId: 'n2', fecha: '2026-10-18', origen: 'domingo', estado: 'suma', sesionIds: ['s1'] },
              { catequizandoId: 'n2', fecha: '2026-10-25', origen: 'domingo', estado: 'suma', sesionIds: ['s2'] },
              { catequizandoId: 'n2', fecha: '2026-11-01', origen: 'domingo', estado: 'suma', sesionIds: ['s3'] },
              { catequizandoId: 'n2', fecha: '2026-11-08', origen: 'domingo', estado: 'suma', sesionIds: ['s4'] },
            ],
          }}
        />
      </Seccion>

      <Seccion titulo="Asistente de catequesis">
        <BurbujaMensaje mensaje={{ id: 'u', autor: 'usuario', texto: '¿Qué es el bautismo?' }} />
        <BurbujaMensaje
          mensaje={{
            id: 'a', autor: 'asistente',
            respuesta: {
              respuesta: 'Según el material público de catequesis: el bautismo es el primer sacramento de la iniciación cristiana.',
              fuentes: [{ id: 'bautismo', documento: 'Catecismo', seccion: 'Bautismo (Mateo 28:19-20)', fuente: 'https://example.org', licencia: 'Dominio público' }],
              proveedor: 'extractivo', modelo: 'extractivo-1', versionCorpus: 'v1',
            },
          }}
        />
        <BurbujaMensaje
          mensaje={{ id: 'g', autor: 'asistente', respuesta: { respuesta: 'No puedo consultar datos de niños, familias, salud, documentos o riesgo. Contacta a la coordinación parroquial.', fuentes: [], proveedor: 'guardia', modelo: 'filtro', versionCorpus: 'v1' } }}
        />
      </Seccion>

      <Seccion titulo="Visor de evidencia">
        <VisorEvidencia urls={[]} />
      </Seccion>
    </ScrollView>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={estilos.seccion}>
      <Text style={[tipografia.encabezado, estilos.titulo]}>{titulo}</Text>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.xl, gap: espacio.xl },
  seccion: { gap: espacio.m },
  titulo: { color: colores.texto },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  glifo: { fontSize: 28 },
});
