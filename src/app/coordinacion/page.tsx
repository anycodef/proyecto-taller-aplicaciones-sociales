import { EncabezadoPantalla } from "@/components/encabezado-pantalla";
import { Pendiente } from "@/components/pendiente";

export default function Coordinacion() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <EncabezadoPantalla
        rol="Coordinacion"
        titulo="Panel del ciclo"
        descripcion="Lo que hoy se resuelve a mano en Excel y WhatsApp."
      />
      <Pendiente
        items={[
          "Asistencia consolidada por grupo contra el minimo del ciclo",
          "Bandeja de justificaciones con la lectura OCR ya resuelta",
          "Catequizandos con senal de riesgo de desercion",
          "Alta de grupos, catequistas e inscripciones",
        ]}
      />
    </main>
  );
}
