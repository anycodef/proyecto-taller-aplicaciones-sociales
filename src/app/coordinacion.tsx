import { PantallaRol } from "@/components/pantalla-rol";

export default function Coordinacion() {
  return (
    <PantallaRol
      rol="Coordinacion"
      titulo="Panel del ciclo"
      descripcion="Lo que hoy se resuelve a mano en Excel y WhatsApp."
      pendientes={[
        "Asistencia consolidada por grupo contra el minimo del ciclo",
        "Bandeja de justificaciones con la lectura OCR ya resuelta",
        "Catequizandos con senal de riesgo de desercion",
        "Alta de grupos, catequistas e inscripciones con consentimiento",
      ]}
    />
  );
}
