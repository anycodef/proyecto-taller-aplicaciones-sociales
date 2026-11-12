import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ProveedorSesion, useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores } from "@/tema";

export default function LayoutRaiz() {
  return (
    <ProveedorSesion>
      <StatusBar style="auto" />
      <Navegacion />
    </ProveedorSesion>
  );
}

/**
 * Guardas solo de presentacion: la sesion decide que grupos se muestran.
 * En SDK 57 `Stack.Protected` no admite `redirectTo` (exige SDK 58).
 */
function Navegacion() {
  const { cargando, tipo, desbloqueada, bloqueada, rolesEfectivos } = useSesion();
  const autenticada = !cargando && desbloqueada && !bloqueada;
  const equipo = autenticada && tipo === "equipo";
  const tieneRolEquipo = rolesEfectivos.some((rol) => rol !== "familia");

  return (
    <Stack
      screenOptions={{
        headerTintColor: colores.primario,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "SIGECAT" }} />
      <Stack.Protected guard={equipo && tieneRolEquipo}>
        {/* Cada grupo pinta su propia cabecera: sin esto se ven dos, una con el nombre del grupo. */}
        <Stack.Screen name="(equipo)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={autenticada && rolesEfectivos.includes("familia") && (tipo === "familia" || equipo)}>
        <Stack.Screen name="(familia)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
