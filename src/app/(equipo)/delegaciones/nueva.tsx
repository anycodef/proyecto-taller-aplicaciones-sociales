import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { Aviso, Boton, CampoTexto, GrupoOpciones } from "@/components/ui";
import { esFechaCivil, finDelDiaEnLima, hoyEnLima, inicioDelDiaEnLima } from "@/lib/seguridad/fechas";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export default function NuevaDelegacion() {
  const { api } = useSesion();
  const cargarCuentas = useCallback(() => api.listarCuentas(), [api]);
  const { datos: cuentas } = useCarga(cargarCuentas);
  const [delegado, setDelegado] = useState<string | null>(null);
  const [desde, setDesde] = useState(hoyEnLima());
  const [hasta, setHasta] = useState(hoyEnLima());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const candidatos = (cuentas ?? []).filter(
    (cuenta) => cuenta.activa && cuenta.roles.includes("catequista") && !cuenta.roles.includes("administracion")
  );

  const delegar = async () => {
    setError(null);
    if (!delegado) {
      setError("Elige a quién se delega.");
      return;
    }
    if (!esFechaCivil(desde) || !esFechaCivil(hasta)) {
      setError("Las fechas van en formato AAAA-MM-DD.");
      return;
    }
    if (hasta < desde) {
      setError("La delegation no puede terminar antes de empezar.");
      return;
    }

    setGuardando(true);
    try {
      await api.crearDelegacion({
        id: Crypto.randomUUID(),
        delegadoId: delegado,
        desde: inicioDelDiaEnLima(desde),
        hasta: finDelDiaEnLima(hasta),
      });
      setGuardando(false);
      router.replace("/delegaciones");
    } catch {
      setGuardando(false);
      setError("No pudimos registrar la delegación.");
    }
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Delegar funciones</Text>

      <Aviso
        tono="informativo"
        mensaje="Quien recibe la delegación tiene exactamente los mismos permisos que la coordinación durante el periodo, aunque sea menor de edad."
      />

      <GrupoOpciones
        etiqueta="Catequista que recibe la delegación"
        valor={delegado}
        alCambiar={setDelegado}
        opciones={candidatos.map((cuenta) => ({ valor: cuenta.id, etiqueta: cuenta.identidadOperativa }))}
      />

      <CampoTexto etiqueta="Desde (AAAA-MM-DD)" valor={desde} alCambiar={setDesde} />
      <CampoTexto etiqueta="Hasta (AAAA-MM-DD)" valor={hasta} alCambiar={setHasta} />

      <Text style={[tipografia.nota, estilos.nota]}>
        Termina a las 23:59:59 de Lima del día elegido.
      </Text>

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}

      <Boton etiqueta="Registrar la delegación" alPresionar={() => void delegar()} cargando={guardando} />
      <Boton etiqueta="Cancelar" variante="enlace" alPresionar={() => router.replace("/delegaciones")} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  nota: { color: colores.textoTenue },
  error: { color: colores.errorTexto },
});
