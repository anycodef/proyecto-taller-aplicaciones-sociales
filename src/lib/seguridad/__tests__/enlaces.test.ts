import { construirUrlEnlace, extraerTokenDeUrl } from "../enlaces";

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
