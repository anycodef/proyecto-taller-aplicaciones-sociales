import { Stack } from "expo-router";

import { colores } from "@/tema";

export default function LayoutFamilia() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colores.primario,
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
