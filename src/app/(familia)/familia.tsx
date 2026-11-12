import { router, type Href } from "expo-router";

import { PantallaRol } from "@/components/pantalla-rol";
import { FilaNavegacion } from "@/components/ui";
import { modulosDelPanel } from "@/lib/navegacion/modulos";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";

export default function Familia() {
  const { rolesEfectivos } = useSesion();
  const modulos = modulosDelPanel("familia", rolesEfectivos);

  return (
    <PantallaRol
      rol="Familia"
      titulo="Mi hijo o hija"
      descripcion="Solo el perfil del propio hijo, nunca el del resto del grupo."
      pendientes={[
        "Asistencias del ciclo y cuantas faltan para el sacramento",
        ...modulos.proximamente.map((modulo) => `${modulo.titulo}: ${modulo.subtitulo.toLowerCase()}`),
      ]}
    >
      {modulos.conectados.map((modulo) => (
        <FilaNavegacion
          key={modulo.id}
          titulo={modulo.titulo}
          subtitulo={modulo.subtitulo}
          alPresionar={() => router.push(modulo.ruta as Href)}
        />
      ))}
      <FilaNavegacion
        titulo="Mis justificaciones"
        subtitulo="Estado de lo que ya enviaste"
        alPresionar={() => router.push("/familia/mis-justificaciones" as Href)}
      />
    </PantallaRol>
  );
}
