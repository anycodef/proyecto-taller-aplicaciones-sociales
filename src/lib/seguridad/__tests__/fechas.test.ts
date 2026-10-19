import { esFechaCivil, finDelDiaEnLima, hoyEnLima, inicioDelDiaEnLima } from "@/lib/seguridad/fechas";

test("RF-104: el fin del periodo de una delegacion cae en el fin del dia de Lima", () => {
  expect(finDelDiaEnLima("2026-10-19")).toBe("2026-10-19T23:59:59-05:00");
  expect(inicioDelDiaEnLima("2026-10-19")).toBe("2026-10-19T00:00:00-05:00");
  expect(esFechaCivil("2026-10-19")).toBe(true);
  expect(esFechaCivil("19-10-2026")).toBe(false);
  expect(esFechaCivil("2026-13-19")).toBe(false);
});

test("RF-104: la fecha de hoy en Lima no depende de la hora del dispositivo", () => {
  const medianocheEnLima = new Date("2026-10-19T02:30:00.000Z");

  expect(hoyEnLima(medianocheEnLima)).toBe("2026-10-18");
  expect(hoyEnLima(new Date("2026-10-19T05:00:00.000Z"))).toBe("2026-10-19");
});
