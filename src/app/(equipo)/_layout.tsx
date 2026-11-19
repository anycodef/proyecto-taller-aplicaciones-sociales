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
          <Stack.Screen name="asistencia/manual" options={{ title: "Registro manual" }} />
          <Stack.Screen name="asistencia/pendientes" options={{ title: "Por enviar" }} />
          <Stack.Screen
            name="asistencia/correccion/[sesionId]/[catequizandoId]"
            options={{ title: "Corregir asistencia" }}
          />
          {/* Después de asistencia: el primer destino de este grupo es la pantalla de reserva de las rutas prohibidas. */}
          <Stack.Screen name="mis-catequizandos" options={{ title: "Mis catequizandos" }} />
        </Stack.Protected>
        <Stack.Protected guard={coordinacion || (equipo && rolesEfectivos.includes("catequista"))}>
          <Stack.Screen name="riesgo" options={{ title: "Riesgo de deserción" }} />
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
        {/* Sin guarda propia, como antes: supervisión ve la bandeja en solo lectura (RF-408) y la API valida cada acción. */}
        <Stack.Screen name="coordinacion/justificaciones/index" options={{ title: "Justificaciones" }} />
        <Stack.Screen name="coordinacion/justificaciones/[loteId]" options={{ title: "Revisar lote" }} />
        <Stack.Screen name="coordinacion/justificaciones/registrar" options={{ title: "Registrar en nombre de" }} />
        <Stack.Screen name="coordinacion/justificaciones/plazo" options={{ title: "Plazo para justificar" }} />
      </Stack>
    </ProveedorAsistencia>
  );
}
