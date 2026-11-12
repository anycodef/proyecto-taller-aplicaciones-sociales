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
        <Stack.Screen name="(equipo)" />
      </Stack.Protected>
      <Stack.Protected guard={autenticada}>
        <Stack.Screen name="asistente" options={{ title: "Asistente de catequesis" }} />
        <Stack.Screen name="catequizandos/[id]/index" options={{ title: "Perfil del niño" }} />
      </Stack.Protected>
      <Stack.Protected guard={autenticada && rolesEfectivos.includes("familia") && (tipo === "familia" || equipo)}>
        <Stack.Screen name="(familia)" />
      </Stack.Protected>
    </Stack>
  );
}
