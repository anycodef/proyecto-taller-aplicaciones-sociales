import { aSesion, elegirSesion } from "@/lib/asistencia/sesiones";
import type { Sesion } from "@/lib/asistencia/tipos";

const cicloId = "33333333-3333-4333-8333-333333333333";

function sesion(extra: Partial<Sesion> = {}): Sesion {
  return {
    id: "sesion-1",
    cicloId,
    fecha: "2026-10-18",
    tipo: "catequesis",
    actividadId: null,
    cancelada: false,
    ventanaInicio: null,
    ventanaFin: null,
    ...extra,
  };
}

test("RF-306: la lista elige la sesión de catequesis del ciclo y de la fecha, no la primera descargada", () => {
  const sesiones = [
    sesion({ id: "misa", tipo: "misa" }),
    sesion({ id: "cancelada", cancelada: true }),
    sesion({ id: "catequesis" }),
    sesion({ id: "otro-ciclo", cicloId: "44444444-4444-4444-8444-444444444444" }),
    sesion({ id: "otra-fecha", fecha: "2026-10-11" }),
  ];

  const elegida = elegirSesion(sesiones, {
    cicloId,
    fecha: "2026-10-18",
    tipo: "catequesis",
  });

  expect(elegida?.id).toBe("catequesis");
});

test("RF-306: con ?sesionId la lista usa esa sesión aunque sea de otro tipo y de otro día", () => {
  const sesiones = [
    sesion({ id: "misa", tipo: "misa" }),
    sesion({ id: "actividad", fecha: "2026-10-20", tipo: "actividad", actividadId: "actividad-1" }),
  ];

  const elegida = elegirSesion(sesiones, {
    cicloId,
    fecha: "2026-10-18",
    tipo: "catequesis",
    sesionId: "actividad",
  });

  expect(elegida?.id).toBe("actividad");
});

test("RF-306: una sesión de otro ciclo no se elige ni por su identificador", () => {
  const sesiones = [sesion({ id: "otro-ciclo", cicloId: "44444444-4444-4444-8444-444444444444" })];

  expect(
    elegirSesion(sesiones, { cicloId, fecha: "2026-10-18", tipo: "catequesis", sesionId: "otro-ciclo" })
  ).toBeUndefined();
});

test("RF-306: la fila de sesión local se traduce al tipo del dominio", () => {
  const traducida = aSesion({
    id: "sesion-1",
    ciclo_id: cicloId,
    fecha: "2026-10-18",
    tipo: "catequesis",
    actividad_id: null,
    cancelada: false,
    ventana_inicio: "09:50:00",
    ventana_fin: null,
  });

  expect(traducida).toEqual({
    id: "sesion-1",
    cicloId,
    fecha: "2026-10-18",
    tipo: "catequesis",
    actividadId: null,
    cancelada: false,
    ventanaInicio: "09:50:00",
    ventanaFin: null,
  });
});
