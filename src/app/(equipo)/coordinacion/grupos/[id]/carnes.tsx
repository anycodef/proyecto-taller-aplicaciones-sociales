import * as Print from "expo-print";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { TarjetaCarne } from "@/components/catequizandos/tarjeta-carne";
import { Aviso, Boton } from "@/components/ui";
import { hojaCarnesHtml } from "@/lib/catequizandos/carne";
import { useCarga } from "@/plataforma/api/usar-carga";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores, espacio, tipografia } from "@/tema";

export default function CarnesDelGrupo({ id }: { id: string }) {
  const { apiCatequizandos } = useSesion();
  const cargar = useCallback(() => apiCatequizandos.listarCarnesGrupo(id), [apiCatequizandos, id]);
  const { datos: carnes, error, cargando } = useCarga(cargar);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const imprimir = async () => {
    if (!carnes?.length) return;
    setImprimiendo(true);
    setFallo(null);
    try {
      const html = hojaCarnesHtml(
        carnes.map((carne) => ({
          nombres: carne.nombres,
          apellidos: carne.apellidos,
          grupo: carne.grupo,
          emision: carne.emision,
          codigoCarne: carne.codigoCarne,
        }))
      );
      if (Platform.OS === "web") await Print.printAsync({ html });
      else await Print.printToFileAsync({ html });
    } catch {
      setFallo("No pudimos preparar la hoja para imprimir.");
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={[tipografia.titulo, estilos.titulo]}>Carnés del grupo</Text>

      {cargando ? <Text style={[tipografia.cuerpo, estilos.texto]}>Cargando los carnés…</Text> : null}
      {error ? <Text style={[tipografia.nota, estilos.error]}>{error}</Text> : null}
      {fallo ? <Aviso tono="error" mensaje={fallo} /> : null}

      <View style={estilos.lista}>
        {carnes?.map((carne) => (
          <TarjetaCarne
            key={carne.catequizandoId}
            nombres={carne.nombres}
            apellidos={carne.apellidos}
            grupo={carne.grupo}
            emision={carne.emision}
            codigoCarne={carne.codigoCarne}
          />
        ))}
      </View>

      <Boton
        etiqueta="Imprimir la hoja de carnés"
        alPresionar={() => void imprimir()}
        cargando={imprimiendo}
        deshabilitado={!carnes?.length}
      />
      <Text style={[tipografia.nota, estilos.nota]}>
        La hoja se genera en el celular y se imprime o se guarda como PDF. Imprimir necesita conexión.
      </Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, backgroundColor: colores.fondo, padding: espacio.xl, gap: espacio.l },
  titulo: { color: colores.texto },
  texto: { color: colores.textoSuave },
  nota: { color: colores.textoTenue },
  error: { color: colores.errorTexto },
  lista: { gap: espacio.l },
});
