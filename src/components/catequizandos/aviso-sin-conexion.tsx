import { Aviso } from "@/components/ui";

export function AvisoSinConexion({ mensaje }: { mensaje?: string }) {
  return <Aviso tono="advertencia" mensaje={mensaje ?? "Inscribir requiere conexión"} />;
}
