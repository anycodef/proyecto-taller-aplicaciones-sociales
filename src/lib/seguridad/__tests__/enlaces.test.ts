import { leerEnlaceAcceso } from "../enlaces";

test("RF-101: un enlace pegado de equipo se reconoce como equipo", () => {
  expect(leerEnlaceAcceso("https://sigecat.app/acceso/equipo#t=abc")).toEqual({ tipo: "equipo", token: "abc" });
});

test("RF-110: un enlace pegado de familia se reconoce como familia", () => {
  expect(leerEnlaceAcceso(" http://localhost:8081/acceso/familia#t=xyz_-1 ")).toEqual({ tipo: "familia", token: "xyz_-1" });
});

test("RF-101: un texto sin token no es un enlace de acceso", () => {
  expect(leerEnlaceAcceso("https://sigecat.app/acceso/familia")).toBeNull();
  expect(leerEnlaceAcceso("hola")).toBeNull();
});
