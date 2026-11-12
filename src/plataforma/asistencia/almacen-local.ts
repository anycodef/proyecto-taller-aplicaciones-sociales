import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

import {
  almacenVacio,
  deserializarAlmacen,
  serializarAlmacen,
  type AlmacenLocal,
} from "@/lib/sincronizacion/almacen-local";

export type AlmacenLocalDisco = {
  leer(): AlmacenLocal;
  guardar(estado: AlmacenLocal): void;
  borrar(): void;
};

const NOMBRE_ARCHIVO = "sigecat-asistencia.json";

/**
 * Almacen local del celular: la nomina sincronizada y las marcas que faltan
 * por enviar. Solo guarda la nomina y los pendientes; los datos restringidos
 * no llegan aqui (RNF-203).
 */
export function crearAlmacenLocal(nombreArchivo: string = NOMBRE_ARCHIVO): AlmacenLocalDisco {
  if (Platform.OS === "web") return crearAlmacenNavegador(nombreArchivo);
  const archivo = new File(Paths.document, nombreArchivo);

  return {
    leer: (): AlmacenLocal => {
      try {
        if (!archivo.exists) return almacenVacio();
        return deserializarAlmacen(archivo.textSync());
      } catch {
        return almacenVacio();
      }
    },
    guardar: (estado: AlmacenLocal): void => {
      archivo.write(serializarAlmacen(estado));
    },
    borrar: (): void => {
      if (archivo.exists) archivo.delete();
    },
  };
}

/**
 * expo-file-system no tiene implementacion real en web (su build web avisa
 * que no esta soportado), asi que en el navegador el estado local vive en el
 * almacenamiento local. Permite revisar y demostrar las pantallas de
 * asistencia en el navegador.
 */
function crearAlmacenNavegador(nombreArchivo: string): AlmacenLocalDisco {
  const disponible = typeof localStorage !== "undefined";
  return {
    leer: () => (disponible ? deserializarAlmacen(localStorage.getItem(nombreArchivo)) : almacenVacio()),
    guardar: (estado) => {
      if (disponible) localStorage.setItem(nombreArchivo, serializarAlmacen(estado));
    },
    borrar: () => {
      if (disponible) localStorage.removeItem(nombreArchivo);
    },
  };
}
