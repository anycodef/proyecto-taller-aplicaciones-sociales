import { construirUrlEnlace, extraerTokenDeUrl, leerEnlaceAcceso } from "../enlaces";

test("RF-111: el token del enlace https viaja en el fragmento y se recupera", () => {
  const url = construirUrlEnlace("https://sigecat.app", "equipo", "abc-DEF_123");
  expect(url).toBe("https://sigecat.app/acceso/equipo#t=abc-DEF_123");
  expect(extraerTokenDeUrl(url)).toBe("abc-DEF_123");
});

test("RF-111: el enlace de Expo Go lleva el token en la consulta porque Expo Go descarta el fragmento", () => {
  expect(extraerTokenDeUrl("exp://192.168.1.8:8081/--/acceso/equipo?t=abc-DEF_123")).toBe("abc-DEF_123");
});

test("RF-111: sin token o con un texto que no es un enlace devuelve null", () => {
  expect(extraerTokenDeUrl("exp://192.168.1.8:8081/--/acceso/equipo")).toBeNull();
  expect(extraerTokenDeUrl("no soy un enlace")).toBeNull();
});

test("RF-110: el enlace sin https se rechaza", () => {
  expect(() => construirUrlEnlace("http://sigecat.app", "familia", "x")).toThrow("enlace_requiere_https");
});

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
