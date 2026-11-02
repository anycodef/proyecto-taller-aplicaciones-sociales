import { abrirLista, alternar, confirmarLista } from "@/lib/asistencia/lista";
import { validarCorreccion } from "@/lib/asistencia/correccion";
import { consolidar } from "@/lib/asistencia/consolidacion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Sesion, MarcaAsistencia, Correccion } from "@/lib/asistencia/tipos";
import { randomUUID } from "node:crypto";

describe("Provocacion de errores en listas de catequesis, correcciones y consolidacion", () => {
  const catequistaId = "00300000-0000-4000-8000-000000000001";
  const otroCatequistaId = "00300000-0000-4000-8000-000000000002";
  const credencialId = randomUUID();
  const dispositivoId = randomUUID();
  const ninoId = "00300000-0000-4000-8000-000000000100";
  const grupoId = "00300000-0000-4000-8000-000000000010";

  const cuentaCatequista: ContextoAcceso = {
    cuentaId: catequistaId,
    credencialId,
    dispositivoId,
    rolesPropios: ["catequista"],
    gruposAsignados: [grupoId],
    catequizandosApoderados: [],
    identidadOperativa: "Luz Catequesis",
    esMenor: true,
  };

  const sesionCatequesis: Sesion = {
    id: "cat-1",
    cicloId: "ciclo-1",
    fecha: "2026-10-11",
    tipo: "catequesis",
    cancelada: false,
  };

  test("RF-306: alternar ninos ajenos o confirmar listas bajo condiciones prohibidas", () => {
    const borrador = abrirLista([{ id: ninoId }]);

    // Alternar un ID de nino que no forma parte del borrador abierto.
    expect(() => alternar(borrador, "nino-inexistente")).toThrow("Niño ajeno a la lista");

    // Intentar confirmar lista para sesion de tipo misa debe lanzar excepcion.
    const sesionMisa: Sesion = { ...sesionCatequesis, tipo: "misa" };
    expect(() =>
      confirmarLista({
        borrador,
        cuenta: cuentaCatequista,
        sesion: sesionMisa,
        grupoId,
        id: randomUUID(),
        generarId: () => randomUUID(),
        abiertaEn: "2026-10-11T10:00:00-05:00",
        hora: "2026-10-11T10:05:00-05:00",
        desfaseRelojMs: 0,
      })
    ).toThrow("Lista no autorizada");

    // Intentar confirmar lista cuando la sesion dominical esta cancelada.
    const sesionCancelada: Sesion = { ...sesionCatequesis, cancelada: true };
    expect(() =>
      confirmarLista({
        borrador,
        cuenta: cuentaCatequista,
        sesion: sesionCancelada,
        grupoId,
        id: randomUUID(),
        generarId: () => randomUUID(),
        abiertaEn: "2026-10-11T10:00:00-05:00",
        hora: "2026-10-11T10:05:00-05:00",
        desfaseRelojMs: 0,
      })
    ).toThrow("Lista no autorizada");

    // Intentar confirmar lista sin identificador de dispositivo registrado.
    const cuentaSinDispositivo: ContextoAcceso = { ...cuentaCatequista, dispositivoId: undefined };
    expect(() =>
      confirmarLista({
        borrador,
        cuenta: cuentaSinDispositivo,
        sesion: sesionCatequesis,
        grupoId,
        id: randomUUID(),
        generarId: () => randomUUID(),
        abiertaEn: "2026-10-11T10:00:00-05:00",
        hora: "2026-10-11T10:05:00-05:00",
        desfaseRelojMs: 0,
      })
    ).toThrow("Lista no autorizada");

    // Intentar confirmar con rol familia o supervision.
    const cuentaFamilia: ContextoAcceso = { ...cuentaCatequista, rolesPropios: ["familia"] };
    expect(() =>
      confirmarLista({
        borrador,
        cuenta: cuentaFamilia,
        sesion: sesionCatequesis,
        grupoId,
        id: randomUUID(),
        generarId: () => randomUUID(),
        abiertaEn: "2026-10-11T10:00:00-05:00",
        hora: "2026-10-11T10:05:00-05:00",
        desfaseRelojMs: 0,
      })
    ).toThrow("Lista no autorizada");
  });

  test("RF-309: validacion de correcciones ante horas incoherentes o autores ajenos", () => {
    const fecha = "2026-10-11";
    const horaValida = `${fecha}T11:00:00-05:00`;
    const recibidoEn = Date.parse(`${fecha}T12:00:00-05:00`);

    const correccionBase: Correccion = {
      id: randomUUID(),
      cicloId: "ciclo-1",
      sesionId: sesionCatequesis.id,
      catequizandoId: ninoId,
      valorAnterior: "ausente",
      valorNuevo: "presente",
      corregidoPor: catequistaId,
      credencialId,
      horaDispositivo: horaValida,
      desfaseRelojMs: 0,
      recibidoEn: new Date(recibidoEn).toISOString(),
      estado: "aceptada",
    };

    // Hora incoherente: la hora del dispositivo es posterior al momento de recepcion del servidor.
    const correccionFutura: Correccion = {
      ...correccionBase,
      horaDispositivo: `${fecha}T13:00:00-05:00`,
    };
    expect(validarCorreccion(correccionFutura, cuentaCatequista, [catequistaId], fecha, recibidoEn)).toBe("hora_incoherente");

    // Hora incoherente: antes del inicio del domingo en cuestion.
    const correccionPrevia: Correccion = {
      ...correccionBase,
      horaDispositivo: "2026-10-10T23:59:59-05:00",
    };
    expect(validarCorreccion(correccionPrevia, cuentaCatequista, [catequistaId], fecha, recibidoEn)).toBe("hora_incoherente");

    // Correccion en domingo por un catequista que no fue autor de la marca original.
    expect(
      validarCorreccion(correccionBase, cuentaCatequista, [otroCatequistaId], fecha, recibidoEn)
    ).toBe("correccion_no_autorizada");

    // Correccion posterior al domingo intentada por coordinacion pero sin motivo.
    const fechaLunes = "2026-10-12";
    const horaLunes = `${fechaLunes}T09:00:00-05:00`;
    const recibidoLunes = Date.parse(`${fechaLunes}T10:00:00-05:00`);
    const cuentaCoord: ContextoAcceso = { ...cuentaCatequista, rolesPropios: ["coordinacion"] };

    const correccionLunesSinMotivo: Correccion = {
      ...correccionBase,
      horaDispositivo: horaLunes,
      motivo: undefined,
    };
    expect(
      validarCorreccion(correccionLunesSinMotivo, cuentaCoord, [catequistaId], fecha, recibidoLunes)
    ).toBe("correccion_no_autorizada");

    // Correccion posterior al domingo por coordinacion con motivo valido debe ser aprobada.
    const correccionLunesConMotivo: Correccion = {
      ...correccionBase,
      horaDispositivo: horaLunes,
      motivo: "Se subsana error de lista reportado por catequista",
    };
    expect(
      validarCorreccion(correccionLunesConMotivo, cuentaCoord, [catequistaId], fecha, recibidoLunes)
    ).toBeNull();
  });

  test("RF-308: consolidacion resuelve conflictos concurrentes priorizando presencia y marcando conflicto", () => {
    // Si solo hay marcas rechazadas, no debe consolidar nada (null).
    const marcaRechazada: MarcaAsistencia = {
      id: "m-rechazada",
      cicloId: "ciclo-1",
      sesionId: sesionCatequesis.id,
      catequizandoId: ninoId,
      valor: "presente",
      tipoRegistro: "escaneo",
      registradoPor: catequistaId,
      credencialId,
      dispositivoId,
      horaDispositivo: "2026-10-11T10:00:00-05:00",
      desfaseRelojMs: 0,
      recibidoEn: "2026-10-11T10:01:00Z",
      estado: "rechazada",
      motivoRechazo: "carne_invalido",
    };
    expect(consolidar([marcaRechazada])).toBeNull();

    // Marcas contradictorias de autores distintos: presente gana y se activa flag de conflicto.
    const marcaPresente: MarcaAsistencia = {
      ...marcaRechazada,
      id: "m-presente",
      valor: "presente",
      estado: "aceptada",
      motivoRechazo: undefined,
    };
    const marcaAusente: MarcaAsistencia = {
      ...marcaRechazada,
      id: "m-ausente",
      valor: "ausente",
      tipoRegistro: "lista",
      registradoPor: otroCatequistaId,
      estado: "aceptada",
      motivoRechazo: undefined,
    };

    const consolidada = consolidar([marcaAusente, marcaPresente]);
    expect(consolidada).not.toBeNull();
    expect(consolidada?.valor).toBe("presente");
    expect(consolidada?.conflicto).toBe(true);
    expect(consolidada?.registradores).toEqual([catequistaId, otroCatequistaId].sort());
  });
});
