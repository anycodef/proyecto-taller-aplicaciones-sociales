import { File, Paths } from "expo-file-system";

import {
  almacenVacio,
  deserializarAlmacen,
  serializarAlmacen,
  type AlmacenLocal,
} from "@/lib/sincronizacion/almacen-local";

const NOMBRE_ARCHIVO = "sigecat-asistencia.json";

export type AlmacenLocalDisco = {
  leer(): AlmacenLocal;
  guardar(almacen: AlmacenLocal): void;
  borrar(): void;
};

/**
 * Almacen local en disco. Solo guarda la nomina sincronizada y las marcas
 * pendientes de enviar; los datos restringidos no llegan aqui (RNF-203).
 */
export function crearAlmacenLocal(nombreArchivo: string = NOMBRE_ARCHIVO): AlmacenLocalDisco {
  const archivo = new File(Paths.document, nombreArchivo);

  return {
    leer(): AlmacenLocal {
      try {
        if (!archivo.exists) return almacenVacio();
        return deserializarAlmacen(archivo.textSync());
      } catch {
        return almacenVacio();
      }
    },
    guardar(almacen: AlmacenLocal): void {
      archivo.write(serializarAlmacen(almacen));
    },
    borrar(): void {
      if (archivo.exists) archivo.delete();
    },
  };
}
