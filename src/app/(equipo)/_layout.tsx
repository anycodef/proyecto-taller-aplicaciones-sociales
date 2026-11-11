import { Stack } from "expo-router";

import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";
import { colores } from "@/tema";

export default function LayoutEquipo() {
  const { rolesEfectivos, contexto, desbloqueada, bloqueada, tipo } = useSesion();
  const equipo = tipo === "equipo" && desbloqueada && !bloqueada;
  const administracion = equipo && rolesEfectivos.includes("administracion");
  const coordinacion = equipo && rolesEfectivos.includes("coordinacion");
  const puedeDelegar = administracion || (equipo && Boolean(contexto?.rolesPropios.includes("coordinacion")));

  return (
    <ProveedorAsistencia>
      <Stack
        screenOptions={{
          headerTintColor: colores.primario,
          headerTitleStyle: { fontWeight: "600" },
        }}
      >
        <Stack.Protected guard={coordinacion}>
          <Stack.Screen name="coordinacion" options={{ title: "Coordinación" }} />
          <Stack.Screen name="coordinacion/grupos/[id]/carnes" options={{ title: "Carnés" }} />
          <Stack.Screen name="avisos-sistema" options={{ title: "Avisos del sistema" }} />
        </Stack.Protected>
        <Stack.Protected guard={equipo && rolesEfectivos.some((rol) => rol !== "familia")}>
          <Stack.Screen name="asistencia" options={{ title: "Pasar lista" }} />
          <Stack.Screen name="asistencia/lista/[grupoId]" options={{ title: "Lista de catequesis" }} />
          <Stack.Screen name="asistencia/pendientes" options={{ title: "Por enviar" }} />
        </Stack.Protected>
        <Stack.Protected guard={administracion || coordinacion}>
          <Stack.Screen name="cuentas/index" options={{ title: "Cuentas" }} />
          <Stack.Screen name="cuentas/nueva" options={{ title: "Nueva cuenta" }} />
          <Stack.Screen name="cuentas/[id]" options={{ title: "Cuenta" }} />
        </Stack.Protected>
        <Stack.Protected guard={puedeDelegar}>
          <Stack.Screen name="delegaciones/index" options={{ title: "Delegaciones" }} />
          <Stack.Screen name="delegaciones/nueva" options={{ title: "Nueva delegación" }} />
        </Stack.Protected>
        <Stack.Protected guard={administracion}>
          <Stack.Screen name="auditoria" options={{ title: "Auditoría" }} />
        </Stack.Protected>
      </Stack>
    </ProveedorAsistencia>
  );
}
