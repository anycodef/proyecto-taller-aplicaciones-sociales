import { PantallaRol } from "@/components/pantalla-rol";

export default function Familia() {
  return (
    <PantallaRol
      rol="Familia"
      titulo="Mi hijo o hija"
      descripcion="Solo el perfil del propio hijo, nunca el del resto del grupo."
      pendientes={[
        "Asistencias del ciclo y cuantas faltan para el sacramento",
        "Envio de justificacion con foto del comprobante, comprimida antes de subir",
        "Estado de revision de cada justificacion enviada",
      ]}
    />
  );
}
