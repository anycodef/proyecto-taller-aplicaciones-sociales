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
import { FormularioJustificacion } from '@/components/justificaciones/formulario-justificacion';
import { SelectorAusencias } from '@/components/justificaciones/selector-ausencias';
import { SelectorCausa } from '@/components/justificaciones/selector-causa';
import { ResumenJustificaciones } from '@/components/justificaciones/resumen-justificaciones';
import { VisorEvidencia } from '@/components/justificaciones/visor-evidencia';
import { CAUSAS, ETIQUETAS_CAUSA } from '@/lib/justificaciones/causas';
import { colores, espacio, tipografia } from '@/tema';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function Galeria() {
  const [verResultado, setVerResultado] = useState(false);
  const [nombre, setNombre] = useState('');
  const [sexo, setSexo] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [causa, setCausa] = useState<string | null>(null);
  const [ausencias, setAusencias] = useState<string[]>(['ana-0108']);

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

      <Seccion titulo="Justificaciones">
        <SelectorAusencias
          opciones={[
            { clave: 'ana-0108', titulo: 'Ana · domingo 8 de noviembre', detalle: 'Misa y catequesis', nota: 'Puedes justificar hasta el 15 de noviembre' },
            { clave: 'luis-0108', titulo: 'Luis · domingo 8 de noviembre', detalle: 'Misa' },
          ]}
          seleccionadas={ausencias}
          alCambiar={setAusencias}
        />
        <SelectorCausa causas={CAUSAS.map((c) => ({ valor: c, etiqueta: ETIQUETAS_CAUSA[c] }))} valor={causa} alCambiar={setCausa} />
      </Seccion>

      <Seccion titulo="Formulario de justificación">
        <FormularioJustificacion
          titulo="Justificar ausencia"
          filas={[{ catequizandoId: 'ana', fecha: '2026-11-08', ausencias: [{ catequizandoId: 'ana', sesionId: 'misa', tipoSesion: 'misa', fecha: '2026-11-08' }] }]}
          nombres={new Map([['ana', 'Ana']])}
          marcadasAlInicio={['ana|2026-11-08|misa']}
          causas={CAUSAS}
          anticipada={false}
          textoFoto="Foto del certificado o comprobante"
        />
      </Seccion>

      <Seccion titulo="Visor de evidencia">
        <VisorEvidencia justificacionId="ejemplo" obtener={async () => Promise.reject(Object.assign(new Error('sin_evidencia'), { codigo: 'sin_evidencia' }))} />
      </Seccion>

      <Seccion titulo="Resumen de justificaciones en el perfil">
        <ResumenJustificaciones
          estados={[
            { id: 'j-1', sesionId: 'misa', tipoSesion: 'misa', fecha: '2026-11-08', estado: 'pendiente' },
            { id: 'j-2', sesionId: 'catequesis', tipoSesion: 'catequesis', fecha: '2026-11-01', estado: 'aprobada' },
            { id: 'j-3', sesionId: 'misa-25', tipoSesion: 'misa', fecha: '2026-10-25', estado: 'rechazada' },
            { id: 'j-4', sesionId: 'misa-18', tipoSesion: 'misa', fecha: '2026-10-18', estado: 'sin_efecto' },
          ]}
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
