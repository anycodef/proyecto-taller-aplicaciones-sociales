import { EncabezadoPantalla } from "@/components/encabezado-pantalla";
import { Pendiente } from "@/components/pendiente";

export default function Asistencia() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <EncabezadoPantalla
        rol="Catequista"
        titulo="Pasar lista"
        descripcion="Un toque por nino. Se guarda en el celular y se envia solo."
      />
      <Pendiente
        items={[
          "Lista del grupo con estado presente, tardanza, ausente o justificado",
          "Indicador de items en cola y de ultima sincronizacion",
          "Historial de la sesion anterior para no repetir el pase de lista",
        ]}
      />
    </main>
  );
}
