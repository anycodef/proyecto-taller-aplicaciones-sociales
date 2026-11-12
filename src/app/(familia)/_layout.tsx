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
      <Stack.Screen name="familia/justificar" options={{ title: "Justificar una ausencia" }} />
      <Stack.Screen name="familia/enviada" options={{ title: "Justificación enviada", headerBackVisible: false }} />
      <Stack.Screen name="familia/mis-justificaciones" options={{ title: "Mis justificaciones" }} />
    </Stack>
  );
}
