import { PantallaRol } from "@/components/pantalla-rol";

export default function Asistencia() {
  return (
    <PantallaRol
      rol="Catequista"
      titulo="Pasar lista"
      descripcion="Un toque por nino. Se guarda en el celular y se envia solo."
      pendientes={[
        "Lista del grupo con estado presente, tardanza, ausente o justificado",
        "Todos marcados como presentes por defecto; solo se desmarca al ausente",
        "Indicador de registros en cola y de ultima sincronizacion",
      ]}
    />
  );
}
