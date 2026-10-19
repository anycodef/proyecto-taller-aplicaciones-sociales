import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { Aviso, Boton, CampoTexto, GrupoOpciones } from "@/components/ui";
import type { Rol } from "@/lib/seguridad/contexto-acceso";
import { rolesAsignables } from "@/lib/seguridad/matriz-permisos";
import { validarAlta } from "@/lib/seguridad/seudonimo";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const ETIQUETA_ROL: Record<string, string> = {
  administracion: "Administración",
  coordinacion: "Coordinación",
  catequista: "Catequista",
  familia: "Familia",
  supervision: "Supervisión",
};

export default function NuevaCuenta() {
  const { api, rolesEfectivos } = useSesion();
  const [seudonimo, setPseudonimo] = useState("");
  const [esMenor, setEsMenor] = useState<boolean | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const roles = rolesAsignables(rolesEfectivos);
  const opciones = roles.map((valor) => ({ valor, etiqueta: ETIQUETA_ROL[valor] ?? valor }));

  const guardar = async () => {
    setError(null);
    if (esMenor === null) {
      setError("Dinos si la persona es menor de edad.");
      return;
    }
    if (!rol) {
      setError("Elige un rol.");
      return;
    }
    const identidadReal = nombres.trim() || apellidos.trim() ? { nombres: nombres.trim(), apellidos: apellidos.trim() } : undefined;
    if (!validarAlta({ esMenor, identidadOperativa: seudonimo, identidadReal })) {
      setError(
        esMenor
          ? "Un menor necesita un seudónimo distinto de su nombre real."
          : "Escribe el seudónimo de la cuenta."
      );
      return;
    }

    setGuardando(true);
    try {
      await api.crearCuenta({
        id: Crypto.randomUUID(),
        identidadOperativa: seudonimo.trim(),
        esMenor,
        roles: [rol as Rol],
        ...(identidadReal ? { identidadReal } : {}),
      });
      setGuardando(false);
      router.replace("/cuentas");
    } catch {
      setGuardando(false);
      setError("No pudimos crear la cuenta.");
    }
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Nueva cuenta</Text>

      <CampoTexto
        etiqueta="Seudónimo"
        marcador="Cómo verá la equipo a esta persona"
        valor={seudonimo}
        alCambiar={setPseudonimo}
      />

      <GrupoOpciones
        etiqueta="Es menor de edad"
        valor={esMenor === null ? null : esMenor ? "si" : "no"}
        alCambiar={(valor) => setEsMenor(valor === "si")}
        opciones={[
          { valor: "no", etiqueta: "No" },
          { valor: "si", etiqueta: "Sí" },
        ]}
      />

      <GrupoOpciones
        etiqueta="Rol"
        valor={rol}
        alCambiar={setRol}
        opciones={opciones}
      />

      <Aviso
        tono="informativo"
        mensaje="La identidad real se escribe una vez y no se vuelve a mostrar. Solo administración puede leerla."
      />

      <CampoTexto etiqueta="Nombres reales" valor={nombres} alCambiar={setNombres} />
      <CampoTexto etiqueta="Apellidos reales" valor={apellidos} alCambiar={setApellidos} />

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}

      <Boton etiqueta="Crear la cuenta" alPresionar={() => void guardar()} cargando={guardando} />
      <Boton etiqueta="Cancelar" variante="enlace" alPresionar={() => router.replace("/cuentas")} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  error: { color: colores.errorTexto },
});
