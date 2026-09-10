import { EncabezadoPantalla } from "@/components/encabezado-pantalla";
import { Pendiente } from "@/components/pendiente";

export default function Familia() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <EncabezadoPantalla
        rol="Familia"
        titulo="Mi hijo o hija"
        descripcion="Solo el perfil del propio hijo, nunca el del resto del grupo."
      />
      <Pendiente
        items={[
          "Asistencias del ciclo y cuantas faltan para el sacramento",
          "Envio de justificacion con foto del documento",
          "Estado de revision de cada justificacion enviada",
        ]}
      />
    </main>
  );
}
