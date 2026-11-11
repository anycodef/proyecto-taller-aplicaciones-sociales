import { useCallback, useState } from "react";
import { router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import * as Crypto from "expo-crypto";

import { Aviso, Boton, CampoTexto, GrupoOpciones, IndicadorPasos, Tarjeta } from "@/components/ui";
import { AvisoSinConexion } from "@/components/catequizandos/aviso-sin-conexion";
import { FormularioInscripcion, ValoresInscripcionPaso1 } from "@/components/catequizandos/formulario-inscripcion";
import { SelectorGrupoSugerido, GrupoSeleccionado } from "@/components/catequizandos/selector-grupo-sugerido";
import { ComponenteConsentimiento } from "@/components/seguridad/consentimiento";
import { useConectividad } from "@/components/catequizandos/use-conectividad";
import { prepararInscripcion } from "@/lib/catequizandos/api";
import type { PeticionInscripcion, RespuestaInscripcion } from "@/lib/catequizandos/contratos";
import { validarInscripcion } from "@/lib/catequizandos/inscripcion";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

type Paso = 1 | 2 | 3 | 4 | 5;

export default function NuevaInscripcion() {
  const { apiCatequizandos } = useSesion();
  const { conConexion } = useConectividad();

  const [paso, setPaso] = useState<Paso>(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<RespuestaInscripcion | undefined>(undefined);
  const [duplicadoReferencia, setDuplicadoReferencia] = useState<string | null>(null);

  const [valoresNino, setValoresNino] = useState<ValoresInscripcionPaso1>({
    nombres: "",
    apellidos: "",
    fechaNacimiento: "",
    sexo: null,
    bautizado: false,
  });
  const [erroresNino, setErroresNino] = useState<string[]>([]);
  const [advertenciasNino, setAdvertenciasNino] = useState<string[]>([]);
  const [edadFueraRangoConfirmada, setEdadFueraRangoConfirmada] = useState(false);

  const [apoderadoNombres, setApoderadoNombres] = useState("");
  const [apoderadoApellidos, setApoderadoApellidos] = useState("");
  const [apoderadoRelacion, setApoderadoRelacion] = useState("madre");
  const [apoderadoContacto, setApoderadoContacto] = useState("");
  const [apoderadoTipoContacto, setApoderadoTipoContacto] = useState<"telefono" | "otro">("telefono");

  const [consentimientoAceptado, setConsentimientoAceptado] = useState<{ id: string; apoderadoId: string; textoId: string } | null>(null);

  const [grupoSeleccionado, setGrupoSeleccionado] = useState<GrupoSeleccionado | null>(null);

  const api = apiCatequizandos;

  const validarPaso1 = useCallback(() => {
    const resultado = validarInscripcion(
      {
        nombres: valoresNino.nombres,
        apellidos: valoresNino.apellidos,
        fechaNacimiento: valoresNino.fechaNacimiento,
        sexo: valoresNino.sexo ?? undefined,
        bautizado: valoresNino.bautizado,
        apoderados: [{ valorContacto: apoderadoContacto }],
        consentimiento: consentimientoAceptado ? { id: "", apoderadoId: "", textoId: "", canal: "presencial" } : undefined,
        edadFueraRangoConfirmada,
      },
      { inicioCiclo: "" }
    );
    setErroresNino(resultado.bloqueos);
    setAdvertenciasNino(resultado.advertencias);
    return resultado.bloqueos.length === 0;
  }, [valoresNino, apoderadoContacto, consentimientoAceptado, edadFueraRangoConfirmada]);

  const inscribir = async () => {
    if (!conConexion) {
      setError("Inscribir requiere conexión");
      return;
    }

    if (!validarPaso1()) {
      setError("Corrige los errores antes de continuar");
      return;
    }

    if (!consentimientoAceptado) {
      setError("Debes aceptar el consentimiento");
      return;
    }

    if (!grupoSeleccionado) {
      setError("Selecciona un grupo");
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const apoderadoId = Crypto.randomUUID();
      const cuentaId = Crypto.randomUUID();
      const credencialId = Crypto.randomUUID();

      const datos: PeticionInscripcion = prepararInscripcion({
        nino: {
          id: Crypto.randomUUID(),
          nombres: valoresNino.nombres.trim(),
          apellidos: valoresNino.apellidos.trim(),
          fechaNacimiento: valoresNino.fechaNacimiento,
          sexo: valoresNino.sexo!,
          bautizado: valoresNino.bautizado,
        },
        apoderados: [
          {
            id: Crypto.randomUUID(),
            apoderado: {
              id: apoderadoId,
              nombres: apoderadoNombres.trim(),
              apellidos: apoderadoApellidos.trim(),
              tipoContacto: apoderadoTipoContacto,
              valorContacto: apoderadoContacto.trim(),
              cuentaId,
              credencialId,
            },
            relacion: apoderadoRelacion as any,
          },
        ],
        grupoId: grupoSeleccionado.id,
        asignacionId: Crypto.randomUUID(),
        consentimiento: {
          id: consentimientoAceptado.id,
          apoderadoId: consentimientoAceptado.apoderadoId,
          textoId: consentimientoAceptado.textoId,
          canal: "presencial",
        },
        documentos: [
          { id: Crypto.randomUUID(), tipo: "documento_identidad" },
          { id: Crypto.randomUUID(), tipo: "partida_nacimiento" },
          { id: Crypto.randomUUID(), tipo: "partida_bautismo" },
          { id: Crypto.randomUUID(), tipo: "boleta_pago" },
          { id: Crypto.randomUUID(), tipo: "ficha_compromiso" },
        ],
        edadFueraRangoConfirmada,
        referenciaDuplicado: duplicadoReferencia ?? undefined,
      });

      const respuesta: RespuestaInscripcion = await api.inscribir(datos);
      setCargando(false);
      setExito(respuesta);
      setPaso(5);
    } catch (err: any) {
      setCargando(false);
      if (err.codigo === "posible_duplicado") {
        setDuplicadoReferencia(err.referencia || "");
        setError("Posible duplicado: ¿es el mismo niño?");
      } else if (err.codigo === "sin_consentimiento") {
        setError("El consentimiento es obligatorio");
      } else if (err.codigo === "edad_fuera_de_rango_sin_confirmar") {
        setError("La edad está fuera del rango y no está confirmada");
      } else {
        setError("No se pudo completar la inscripción");
      }
    }
  };

  const confirmarDuplicado = async (esElMismo: boolean) => {
    if (!duplicadoReferencia) return;
    setCargando(true);
    try {
      await api.confirmarDuplicado(duplicadoReferencia, esElMismo);
      setCargando(false);
      setDuplicadoReferencia(null);
      if (esElMismo) {
        setPaso(5);
      } else {
        setError("Se canceló el duplicado. Puedes continuar con un perfil nuevo.");
      }
    } catch {
      setCargando(false);
      setError("No se pudo confirmar el duplicado");
    }
  };

  const volverAPaso1 = () => setPaso(1);
  const volverAPaso2 = () => setPaso(2);
  const volverAPaso3 = () => setPaso(3);

  const exitoId = exito?.catequizandoId;
  const exitoCodigo = exito?.codigoCarne;

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      {!cargando && !exito && !duplicadoReferencia && (
        <>
          <IndicadorPasos actual={paso} total={4} />

          {!conConexion && (
            <AvisoSinConexion mensaje="Sin conexión. Los datos se guardan en memoria y se envían al reconectar." />
          )}

          {error ? <Aviso tono="error" mensaje={error} /> : null}

          {paso === 1 && (
            <>
              <Text style={[tipografia.encabezado, estilos.tituloPaso]}>Paso 1 de 4: Datos del niño</Text>
              <FormularioInscripcion
                valores={valoresNino}
                setValores={setValoresNino}
                errores={erroresNino}
                advertencias={advertenciasNino}
              />
              {advertenciasNino.includes("edad_fuera_de_rango_sin_confirmar") && edadFueraRangoConfirmada === false && (
                <Boton etiqueta="Confirmar edad fuera de rango" alPresionar={() => setEdadFueraRangoConfirmada(true)} variante="secundario" />
              )}
              <Boton
                etiqueta="Siguiente: Apoderado"
                alPresionar={() => {
                  if (validarPaso1()) {
                    setPaso(2);
                  }
                }}
                deshabilitado={erroresNino.length > 0}
              />
            </>
          )}

          {paso === 2 && (
            <>
              <Text style={[tipografia.encabezado, estilos.tituloPaso]}>Paso 2 de 4: Apoderado</Text>
              <Text style={[tipografia.cuerpo, estilos.texto]}>
                Registra al apoderado principal del niño.
              </Text>
              <CampoTexto
                etiqueta="Nombres del apoderado"
                valor={apoderadoNombres}
                alCambiar={setApoderadoNombres}
              />
              <CampoTexto
                etiqueta="Apellidos del apoderado"
                valor={apoderadoApellidos}
                alCambiar={setApoderadoApellidos}
              />
              <CampoTexto
                etiqueta="Teléfono o contacto"
                valor={apoderadoContacto}
                alCambiar={setApoderadoContacto}
              />
              <GrupoOpciones
                etiqueta="Tipo de contacto"
                valor={apoderadoTipoContacto}
                alCambiar={(v) => setApoderadoTipoContacto(v === "otro" ? "otro" : "telefono")}
                opciones={[
                  { valor: "telefono", etiqueta: "Teléfono" },
                  { valor: "otro", etiqueta: "Otro" },
                ]}
              />
              <GrupoOpciones
                etiqueta="Relación"
                valor={apoderadoRelacion}
                alCambiar={setApoderadoRelacion}
                opciones={[
                  { valor: "madre", etiqueta: "Madre" },
                  { valor: "padre", etiqueta: "Padre" },
                  { valor: "otro_familiar", etiqueta: "Otro familiar" },
                  { valor: "tutor", etiqueta: "Tutor" },
                ]}
              />
              <Boton etiqueta="Atrás" variante="enlace" alPresionar={volverAPaso1} />
              <Boton
                etiqueta="Siguiente: Consentimiento"
                alPresionar={() => setPaso(3)}
                deshabilitado={!apoderadoNombres.trim() || !apoderadoApellidos.trim() || !apoderadoContacto.trim()}
              />
            </>
          )}

          {paso === 3 && (
            <>
              <Text style={[tipografia.encabezado, estilos.tituloPaso]}>Paso 3 de 4: Consentimiento</Text>
              <ComponenteConsentimiento
                alAceptar={(texto) => {
                  setConsentimientoAceptado({
                    id: texto.id,
                    apoderadoId: Crypto.randomUUID(),
                    textoId: texto.id,
                  });
                }}
              />
              <Boton etiqueta="Atrás" variante="enlace" alPresionar={volverAPaso2} />
              <Boton
                etiqueta="Siguiente: Grupo"
                alPresionar={() => setPaso(4)}
                deshabilitado={!consentimientoAceptado}
              />
            </>
          )}

          {paso === 4 && (
            <>
              <Text style={[tipografia.encabezado, estilos.tituloPaso]}>Paso 4 de 4: Grupo sugerido</Text>
              <SelectorGrupoSugerido
                sugerencias={[]}
                grupoSeleccionado={grupoSeleccionado}
                onSeleccionarGrupo={setGrupoSeleccionado}
              />
              <Boton etiqueta="Atrás" variante="enlace" alPresionar={volverAPaso3} />
              <Boton
                etiqueta="Inscribir"
                alPresionar={inscribir}
                cargando={cargando}
                deshabilitado={!grupoSeleccionado || !consentimientoAceptado}
              />
            </>
          )}

          {paso === 5 && (
            <>
              <Text style={[tipografia.encabezado, estilos.tituloExito]}>Inscripción completada</Text>
              {exitoId ? (
                <Tarjeta>
                  <Text style={[tipografia.cuerpoFuerte, estilos.texto]}>{exitoId}</Text>
                  <Text style={[tipografia.cuerpo, estilos.texto]}>
                    Código del carné: {exitoCodigo}
                  </Text>
                </Tarjeta>
              ) : null}
              <Boton etiqueta="Ver carné" alPresionar={() => {
                if (exitoId) router.push(`/catequizandos/${exitoId}/carne` as Href);
              }} />
              <Boton etiqueta="Inscribir otro niño" variante="secundario" alPresionar={() => setPaso(1)} />
            </>
          )}
        </>
      )}

      {duplicadoReferencia && (
        <>
          <Aviso tono="advertencia" mensaje="Posible duplicado: ¿es el mismo niño?" />
          <Boton etiqueta="Sí, es el mismo" alPresionar={() => confirmarDuplicado(true)} />
          <Boton etiqueta="No, es otro niño" variante="secundario" alPresionar={() => confirmarDuplicado(false)} />
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  tituloPaso: { color: colores.primario, fontWeight: "600", fontSize: 20, marginBottom: espacio.s },
  texto: { color: colores.textoSuave },
  tituloExito: { color: colores.primario, fontWeight: "600", fontSize: 24, textAlign: "center" },
  textoExito: { color: colores.texto, textAlign: "center" },
});
