import * as ImagePicker from "expo-image-picker";

export type OrigenFoto = "camara" | "galeria";
export type ResultadoEleccion = { uri: string } | { cancelada: true } | { denegado: true };

/** Pide el permiso solo cuando se usa la cámara; la galería del navegador y del sistema no lo necesita. */
export async function elegirFoto(origen: OrigenFoto): Promise<ResultadoEleccion> {
  if (origen === "camara") {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return { denegado: true };
  }
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false, exif: false };
  const resultado = origen === "camara" ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  if (resultado.canceled || !resultado.assets[0]) return { cancelada: true };
  return { uri: resultado.assets[0].uri };
}
