import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Aviso, Boton, CampoTexto, GrupoOpciones } from "@/components/ui";
import { estaEnRangoCatequesis, edadAlInicioDelCiclo } from "@/lib/catequizandos/edad";
import { validarInscripcion } from "@/lib/catequizandos/inscripcion";
import { colores, espacio, radio, tipografia } from "@/tema";

type Sexo = "femenino" | "masculino";

export type ValoresInscripcionPaso1 = {
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: Sexo | null;
  bautizado: boolean;
};

export function FormularioInscripcion({
  valores,
  setValores,
  errores,
  advertencias,
}: {
  valores: ValoresInscripcionPaso1;
  setValores: (valores: ValoresInscripcionPaso1) => void;
  errores: string[];
  advertencias: string[];
}) {
  const cambiar = (campo: keyof ValoresInscripcionPaso1, valor: string | boolean) => {
    setValores({ ...valores, [campo]: valor });
  };

  const edad = valores.fechaNacimiento
    ? edadAlInicioDelCiclo(valores.fechaNacimiento, valores.fechaNacimiento)
    : null;
  const enRango = edad !== null && estaEnRangoCatequesis(edad);

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Datos del niño</Text>
      <Text style={[tipografia.cuerpo, estilos.texto]}>
        Registra los datos obligatorios. La edad se calcula al inicio del ciclo.
      </Text>

      <CampoTexto
        etiqueta="Nombres"
        marcador="Nombres del niño"
        valor={valores.nombres}
        alCambiar={(v) => cambiar("nombres", v)}
        error={errores.includes("datos_obligatorios") && !valores.nombres?.trim() ? "Obligatorio" : undefined}
      />
      <CampoTexto
        etiqueta="Apellidos"
        marcador="Apellidos del niño"
        valor={valores.apellidos}
        alCambiar={(v) => cambiar("apellidos", v)}
        error={errores.includes("datos_obligatorios") && !valores.apellidos?.trim() ? "Obligatorio" : undefined}
      />
      <CampoTexto
        etiqueta="Fecha de nacimiento"
        marcador="AAAA-MM-DD"
        valor={valores.fechaNacimiento}
        alCambiar={(v) => cambiar("fechaNacimiento", v)}
        error={errores.includes("fecha_invalida") || (errores.includes("datos_obligatorios") && !valores.fechaNacimiento) ? "Fecha inválida" : undefined}
      />
      <GrupoOpciones
        etiqueta="Sexo"
        valor={valores.sexo ?? null}
        alCambiar={(v) => cambiar("sexo", v as Sexo)}
        opciones={[
          { valor: "femenino", etiqueta: "Femenino" },
          { valor: "masculino", etiqueta: "Masculino" },
        ]}
      />
      <GrupoOpciones
        etiqueta="¿Está bautizado?"
        valor={valores.bautizado ? "si" : "no"}
        alCambiar={(v) => cambiar("bautizado", v === "si")}
        opciones={[
          { valor: "si", etiqueta: "Sí" },
          { valor: "no", etiqueta: "No" },
        ]}
      />

      {advertencias.includes("edad_fuera_de_rango_sin_confirmar") && (
        <Aviso tono="advertencia" mensaje="La edad está fuera del rango de 8 a 13 años. Confirma para continuar." />
      )}

      {errores.length > 0 && (
        <Aviso tono="error" mensaje="Completa los campos obligatorios antes de continuar." />
      )}

      {edad !== null && (
        <View style={estilos.edadTarjeta}>
          <Text style={[tipografia.cuerpo, estilos.edadTexto]}>
            Edad al inicio del ciclo: {edad} años
          </Text>
          {enRango && (
            <Text style={[tipografia.cuerpo, estilos.edadTexto, { color: colores.primarioTexto }]}>
              Dentro del rango de catequesis (8 a 13 años)
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.m },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  edadTarjeta: {
    marginTop: espacio.m,
    padding: espacio.l,
    backgroundColor: colores.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  edadTexto: { color: colores.textoSuave },
});
