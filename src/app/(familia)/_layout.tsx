import { Stack } from "expo-router";

import { colores } from "@/tema";

export default function LayoutFamilia() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colores.primario,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="familia/index" options={{ title: "Inicio" }} />
      <Stack.Screen name="familia/justificar" options={{ title: "Justificar ausencia" }} />
      <Stack.Screen name="familia/anticipar" options={{ title: "Avisar evento escolar" }} />
      <Stack.Screen name="familia/enviada" options={{ title: "Justificación recibida", headerBackVisible: false }} />
    </Stack>
  );
}
