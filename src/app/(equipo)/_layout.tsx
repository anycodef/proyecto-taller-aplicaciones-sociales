import { Stack } from "expo-router";

import { colores } from "@/tema";

export default function LayoutEquipo() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colores.primario,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="coordinacion" options={{ title: "Coordinación" }} />
      <Stack.Screen name="asistencia" options={{ title: "Pasar lista" }} />
      <Stack.Screen name="cuentas/index" options={{ title: "Cuentas" }} />
      <Stack.Screen name="cuentas/nueva" options={{ title: "Nueva cuenta" }} />
      <Stack.Screen name="cuentas/[id]" options={{ title: "Cuenta" }} />
      <Stack.Screen name="delegaciones/index" options={{ title: "Delegaciones" }} />
      <Stack.Screen name="delegaciones/nueva" options={{ title: "Nueva delegación" }} />
      <Stack.Screen name="auditoria" options={{ title: "Auditoría" }} />
      <Stack.Screen name="avisos-sistema" options={{ title: "Avisos del sistema" }} />
    </Stack>
  );
}
