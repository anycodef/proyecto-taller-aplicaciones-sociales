import { Stack } from "expo-router";

import { colores } from "@/tema";

export default function LayoutEquipo() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colores.primario,
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
