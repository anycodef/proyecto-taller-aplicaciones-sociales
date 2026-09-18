import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function LayoutRaiz() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTintColor: "#1e3a8a",
          headerTitleStyle: { fontWeight: "600" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "SIGECAT" }} />
        <Stack.Screen name="asistencia" options={{ title: "Pasar lista" }} />
        <Stack.Screen name="coordinacion" options={{ title: "Panel del ciclo" }} />
        <Stack.Screen name="familia" options={{ title: "Mi hijo o hija" }} />
      </Stack>
    </>
  );
}
