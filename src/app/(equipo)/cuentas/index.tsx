import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Boton, FilaNavegacion, Insignia } from "@/components/ui";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

const ETIQUETA_ROL: Record<string, string> = {
  administracion: "Administración",
  coordinacion: "Coordinación",
  catequista: "Catequista",
  familia: "Familia",
  supervision: "Supervisión",
};

export default function ListaCuentas() {
  const { api } = useSesion();
  const { datos, error, cargando, recargar } = useCarga(api.listarCuentas);

  if (cargando) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={[tipografia.cuerpo, estilos.texto]}>Cargando cuentas…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Cuentas</Text>

      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}

      {datos?.length === 0 ? (
        <Text style={[tipografia.cuerpo, estilos.texto]}>Todavía no hay cuentas que gestionar.</Text>
      ) : null}

      <View style={estilos.lista}>
        {datos?.map((cuenta) => (
          <FilaNavegacion
            key={cuenta.id}
            titulo={cuenta.identidadOperativa}
            subtitulo={cuenta.activa ? undefined : "Desactivada"}
            derecha={
              <View style={estilos.insignias}>
                {cuenta.roles.map((rol) => (
                  <Insignia key={rol} texto={ETIQUETA_ROL[rol] ?? rol} tono="suave" />
                ))}
              </View>
            }
            alPresionar={() => router.push({ pathname: "/cuentas/[id]", params: { id: cuenta.id } })}
          />
        ))}
      </View>

      <Boton
        etiqueta="Dar de alta una cuenta"
        alPresionar={() => router.push("/cuentas/nueva")}
      />
      <Boton etiqueta="Actualizar la lista" variante="secundario" alPresionar={recargar} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  error: { color: colores.errorTexto },
  lista: { gap: espacio.s },
  insignias: { flexDirection: "row", gap: espacio.xs },
});
