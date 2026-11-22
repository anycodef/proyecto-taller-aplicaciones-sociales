import { etiquetaAviso, domingosDeSesiones, ordenarAvisos, textoAviso, type AvisoAsistencia } from "@/lib/asistencia/avisos-asistencia";
import { cambiarSesion, sesionesVigentes } from "@/lib/asistencia/cambio-sesion";
import { confirmacionDe, idMarcaEscaneo, lecturaRepetida, procesarEscaneo } from "@/lib/asistencia/escaneo";
import { borradorGuardado, listaConfirmadaLocal, rechazadosDeLaCuenta, textoMotivo } from "@/lib/asistencia/estado-lista";
import { gruposParaLista } from "@/lib/asistencia/menu-asistencia";
import {
  crearMarca,
  guardarCorreccion,
  guardarLista,
  guardarMarca,
  idListaAsistencia,
  marcaALocal,
  PENDIENTES_VACIOS,
  prepararLote,
  type DatosMarca,
  type FilaLista,
} from "@/lib/asistencia/pendientes";
import { domingoDeReferencia } from "@/lib/asistencia/reporte-misa";
import { aSesion } from "@/lib/asistencia/sesiones";
import type { Sesion } from "@/lib/asistencia/tipos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import {
  almacenVacio,
  deserializarAlmacen,
  fusionarTrasSincronizar,
  purgarExceptoPendientes,
  serializarAlmacen,
  type AlmacenLocal,
} from "@/lib/sincronizacion/almacen-local";

const cicloId = "33333333-3333-4333-8333-333333333333";
const sesionId = "11111111-1111-4111-8111-111111111111";
const ninoId = "22222222-2222-4222-8222-222222222222";
const yo = "44444444-4444-4444-8444-444444444444";
const otraCuenta = "77777777-7777-4777-8777-777777777777";

function cuenta(roles: ContextoAcceso["rolesPropios"], extra: Partial<ContextoAcceso> = {}): ContextoAcceso {
  return {
    cuentaId: yo,
    credencialId: "55555555-5555-4555-8555-555555555555",
    dispositivoId: "66666666-6666-4666-8666-666666666666",
    rolesPropios: roles,
    gruposAsignados: ["grupo-1"],
    catequizandosApoderados: [],
    identidadOperativa: "Luz",
    esMenor: false,
    ...extra,
  };
}

function datosMarca(extra: Partial<DatosMarca> = {}): DatosMarca {
  return {
    sesionId,
    cicloId,
    catequizandoId: ninoId,
    valor: "presente",
    tipoRegistro: "manual",
    listaId: null,
    registradoPor: yo,
    cuentaId: yo,
    credencialId: "credencial",
    dispositivoId: "dispositivo",
    horaDispositivo: "2026-10-18T13:00:00.000Z",
    desfaseRelojMs: 0,
    ...extra,
  };
}

function filaLista(extra: Partial<FilaLista> = {}): FilaLista {
  return {
    id: idListaAsistencia(sesionId, "grupo-1"),
    ciclo_id: cicloId,
    sesion_id: sesionId,
    grupo_id: "grupo-1",
    confirmada_por: yo,
    cuenta_id: yo,
    credencial_id: "credencial",
    dispositivo_id: "dispositivo",
    abierta_en: "2026-10-18T15:00:00.000Z",
    confirmada_en: "2026-10-18T15:01:00.000Z",
    desfase_reloj_ms: 0,
    total_presentes: 1,
    total_ausentes: 1,
    ...extra,
  };
}

function conNomina(): AlmacenLocal {
  return {
    ...almacenVacio(),
    colecciones: {
      catequizandos: { [ninoId]: { id: ninoId, nombres: "Mateo", apellidos: "Vargas", grupo_id: "grupo-1", codigo_carne: null, activo: true } },
      grupos: { "grupo-1": { id: "grupo-1", nombre: "Grupo A", ciclo_id: cicloId } },
      borradores_lista: { b: { id: "b", valores: "{}" } },
    },
    ultimoPulso: 1000,
    huellaAlcance: "huella",
  };
}

describe("purga al cerrar sesión", () => {
  test("RF-307: purgarExceptoPendientes conserva solo los pendientes de la cuenta indicada", () => {
    const mia = crearMarca(datosMarca());
    const ajena = crearMarca(datosMarca({ catequizandoId: "otro", cuentaId: otraCuenta, registradoPor: otraCuenta }));
    const almacen = { ...conNomina(), pendientes: guardarMarca(guardarMarca(PENDIENTES_VACIOS, mia), ajena) };

    const purgado = purgarExceptoPendientes(almacen, yo);

    expect(purgado.pendientes.marcas.map((marca) => marca.id)).toEqual([mia.id]);
  });

  test("RNF-306: tras purgar no queda la nómina en el celular", () => {
    const purgado = purgarExceptoPendientes(conNomina(), yo);
    const enDisco = serializarAlmacen(purgado);

    expect(purgado.colecciones).toEqual({});
    expect(purgado.ultimoPulso).toBeNull();
    expect(enDisco).not.toContain("Mateo");
    expect(enDisco).not.toContain("Vargas");
  });
});

describe("fusión tras sincronizar", () => {
  test("RF-307: lo registrado durante el push (lista y corrección) no se pierde", () => {
    const marca = crearMarca(datosMarca());
    const antes: AlmacenLocal = { ...almacenVacio(), pendientes: guardarMarca(PENDIENTES_VACIOS, marca) };
    // El servidor guardo la marca y el pull trajo la nomina.
    const resultado: AlmacenLocal = { ...conNomina(), pendientes: PENDIENTES_VACIOS };
    // Mientras tanto se confirmo una lista y se hizo una correccion.
    const actual: AlmacenLocal = {
      ...antes,
      pendientes: guardarCorreccion(guardarLista(antes.pendientes, { id: "lista-1", fila: filaLista() }), {
        id: "correccion-1",
        fila: {
          id: "correccion-1", ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: ninoId, valor_anterior: "ausente",
          valor_nuevo: "presente", motivo: null, corregido_por: yo, cuenta_id: yo, credencial_id: "c", dispositivo_id: "d",
          hora_dispositivo: "2026-10-18T15:30:00.000Z", desfase_reloj_ms: 0,
        },
      }),
    };

    const fusionado = fusionarTrasSincronizar(antes, resultado, actual);

    expect(fusionado.pendientes.marcas).toHaveLength(0);
    expect(fusionado.pendientes.listas.map((lista) => lista.id)).toEqual(["lista-1"]);
    expect(fusionado.pendientes.correcciones.map((correccion) => correccion.id)).toEqual(["correccion-1"]);
    expect(fusionado.colecciones.catequizandos?.[ninoId]).toBeTruthy();
    expect(fusionado.ultimoPulso).toBe(1000);
  });

  test("RF-307: un pendiente reescrito con otro valor durante el push se conserva", () => {
    const marca = crearMarca(datosMarca());
    const antes: AlmacenLocal = { ...almacenVacio(), pendientes: guardarMarca(PENDIENTES_VACIOS, marca) };
    const resultado: AlmacenLocal = { ...antes, pendientes: PENDIENTES_VACIOS };
    const actual: AlmacenLocal = {
      ...antes,
      pendientes: guardarMarca(PENDIENTES_VACIOS, crearMarca(datosMarca({ valor: "ausente" }))),
    };

    const fusionado = fusionarTrasSincronizar(antes, resultado, actual);

    expect(fusionado.pendientes.marcas).toHaveLength(1);
    expect(fusionado.pendientes.marcas[0].fila.valor).toBe("ausente");
  });

  test("RF-306: los borradores de lista no se pierden aunque el pull rehaga la nómina", () => {
    const antes = conNomina();
    const resultado: AlmacenLocal = { ...antes, colecciones: { ...antes.colecciones, catequizandos: {} } };
    const actual: AlmacenLocal = {
      ...antes,
      colecciones: { ...antes.colecciones, borradores_lista: { b: { id: "b", valores: JSON.stringify({ [ninoId]: "ausente" }) } } },
    };

    const fusionado = fusionarTrasSincronizar(antes, resultado, actual);

    expect(borradorGuardado(fusionado, "b")).toEqual({ [ninoId]: "ausente" });
    expect(fusionado.colecciones.catequizandos).toEqual({});
  });

  test("RF-307: un almacén guardado por la versión anterior se lee sin perder pendientes", () => {
    const viejo = JSON.stringify({ colecciones: {}, pendientes: { marcas: [crearMarca(datosMarca())], listas: [], correcciones: [] }, ultimoPulso: null, huellaAlcance: null });
    const leido = deserializarAlmacen(viejo);

    expect(leido.pendientes.marcas).toHaveLength(1);
    expect(leido.pendientes.sesiones).toEqual([]);
    expect(leido.ultimoResumen).toBeNull();
  });
});

describe("lista confirmada", () => {
  test("RF-306: una lista pendiente se reconoce como confirmada y por enviar", () => {
    const almacen: AlmacenLocal = {
      ...almacenVacio(),
      pendientes: guardarLista(PENDIENTES_VACIOS, { id: idListaAsistencia(sesionId, "grupo-1"), fila: filaLista() }),
    };

    const lista = listaConfirmadaLocal(almacen, sesionId, "grupo-1");

    expect(lista).toMatchObject({ porEnviar: true, rechazada: false, totalPresentes: 1, totalAusentes: 1 });
    expect(listaConfirmadaLocal(almacen, sesionId, "grupo-2")).toBeNull();
  });

  test("RF-303: la lista y las marcas rechazadas vuelven del servidor con su motivo", () => {
    const id = idListaAsistencia(sesionId, "grupo-1");
    const almacen: AlmacenLocal = {
      ...almacenVacio(),
      colecciones: {
        listas_asistencia: { [id]: { id, cuenta_id: yo, sesion_id: sesionId, total_presentes: 3, total_ausentes: 0, estado: "rechazada", motivo_rechazo: "lista_fuera_de_ventana" } },
        marcas_asistencia: {
          m1: { id: "m1", cuenta_id: yo, sesion_id: sesionId, catequizando_id: ninoId, estado: "rechazada", motivo_rechazo: "carne_invalido" },
          m2: { id: "m2", cuenta_id: otraCuenta, sesion_id: sesionId, catequizando_id: ninoId, estado: "rechazada", motivo_rechazo: "carne_invalido" },
          m3: { id: "m3", cuenta_id: yo, sesion_id: sesionId, catequizando_id: ninoId, estado: "aceptada" },
        },
      },
    };

    expect(listaConfirmadaLocal(almacen, sesionId, "grupo-1")).toMatchObject({ porEnviar: false, rechazada: true });
    const rechazados = rechazadosDeLaCuenta(almacen, yo);
    expect(rechazados.map((fila) => fila.id).sort()).toEqual([id, "m1"].sort());
    expect(textoMotivo("carne_invalido")).toBe("El carné no es válido.");
    expect(textoMotivo("motivo_nuevo")).toBe("El servidor no aceptó este registro.");
  });
});

describe("escaneo", () => {
  const sesionMisa: Sesion = { id: sesionId, cicloId, fecha: "2026-10-18", tipo: "misa", cancelada: false };
  const codigo = `SGC1:${ninoId}:1`;
  const nomina = [{ id: ninoId, nombres: "Mateo", apellidos: "Vargas", grupoId: "grupo-2", codigoCarne: codigo, activo: true }];

  test("RF-302: el mismo código leído dentro de 2 s se ignora", () => {
    expect(lecturaRepetida(null, codigo, 1000)).toBe(false);
    expect(lecturaRepetida({ codigo, en: 1000 }, codigo, 2999)).toBe(true);
    expect(lecturaRepetida({ codigo, en: 1000 }, codigo, 3000)).toBe(false);
    expect(lecturaRepetida({ codigo, en: 1000 }, "SGC1:otro:1", 1500)).toBe(false);
  });

  test("RF-307: el id del escaneo es determinista por sesión y carné", () => {
    expect(idMarcaEscaneo(sesionId, ninoId, codigo)).toBe(idMarcaEscaneo(sesionId, ninoId, codigo));
    expect(idMarcaEscaneo(sesionId, null, "SGC1:x:1")).not.toBe(idMarcaEscaneo(sesionId, null, "SGC1:y:1"));
  });

  test("RNF-307: escanear a un niño de otro grupo confirma «Registrado» sin nombre y guarda el código leído", () => {
    const resultado = procesarEscaneo({
      cuenta: cuenta(["catequista"]), sesion: sesionMisa, codigo, nomina, conConexion: false, existentes: [],
      id: idMarcaEscaneo(sesionId, ninoId, codigo), horaDispositivo: "2026-10-18T13:10:00.000Z", desfaseRelojMs: 0,
    });

    expect(confirmacionDe(resultado)).toBe("otro_grupo");
    expect(marcaALocal(resultado.marca!).codigo_leido).toBe(codigo);
  });

  test("RF-307: las marcas de lista y manuales no llevan codigo_leido en el lote", () => {
    const lote = prepararLote(guardarMarca(PENDIENTES_VACIOS, crearMarca(datosMarca())));
    expect("codigo_leido" in lote.marcas_asistencia.created[0]).toBe(false);
  });
});

describe("domingos del ciclo", () => {
  const misa: Sesion = { id: sesionId, cicloId, fecha: "2026-11-01", tipo: "misa", cancelada: false };

  test("RF-301: la coordinación marca un domingo sin misa con motivo y queda pendiente de envío", () => {
    const resultado = cambiarSesion(cuenta(["coordinacion"]), misa, { cancelada: true, motivoCancelacion: " Fiesta patronal " });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.fila).toMatchObject({ cancelada: true, motivo_cancelacion: "Fiesta patronal", actualizado_por: yo, cuenta_id: yo });

    const pendientes = { ...PENDIENTES_VACIOS, sesiones: [{ id: resultado.fila.id, fila: resultado.fila }] };
    expect(prepararLote(pendientes).sesiones?.updated).toEqual([resultado.fila]);
    const vigentes = sesionesVigentes([{ id: sesionId, ciclo_id: cicloId, fecha: "2026-11-01", tipo: "misa", cancelada: false }], pendientes);
    expect(vigentes[0]).toMatchObject({ cancelada: true, porEnviar: true });
  });

  test("RF-301: sin motivo no se marca un domingo sin misa", () => {
    expect(cambiarSesion(cuenta(["coordinacion"]), misa, { cancelada: true, motivoCancelacion: "  " })).toEqual({ ok: false, error: "motivo_requerido" });
  });

  test("RF-301: la coordinación cambia la ventana de un domingo", () => {
    const resultado = cambiarSesion(cuenta(["coordinacion"]), misa, { cancelada: false, ventanaInicio: "08:00", ventanaFin: "10:00" });
    expect(resultado.ok && resultado.fila).toMatchObject({ ventana_inicio: "08:00", ventana_fin: "10:00", motivo_cancelacion: null });
    expect(cambiarSesion(cuenta(["coordinacion"]), misa, { cancelada: false, ventanaInicio: "10:00", ventanaFin: "08:00" })).toEqual({ ok: false, error: "ventana_invalida" });
    expect(cambiarSesion(cuenta(["coordinacion"]), misa, { cancelada: false, ventanaInicio: "8", ventanaFin: "10:00" })).toEqual({ ok: false, error: "hora_invalida" });
  });

  test("RF-301: un catequista no cambia sesiones", () => {
    expect(cambiarSesion(cuenta(["catequista"]), misa, { cancelada: true, motivoCancelacion: "x" })).toEqual({ ok: false, error: "no_autorizado" });
  });

  test("RF-301: los domingos juntan misa y catequesis y omiten actividades", () => {
    const domingos = domingosDeSesiones([
      aSesion({ id: "c", ciclo_id: cicloId, fecha: "2026-10-18", tipo: "catequesis", cancelada: true }),
      aSesion({ id: "m", ciclo_id: cicloId, fecha: "2026-10-18", tipo: "misa", cancelada: false }),
      aSesion({ id: "a", ciclo_id: cicloId, fecha: "2026-10-11", tipo: "actividad", cancelada: false }),
    ]);
    expect(domingos).toEqual([{ fecha: "2026-10-18", misa: { id: "m", cancelada: false }, catequesis: { id: "c", cancelada: true } }]);
  });
});

describe("avisos, menú y reporte", () => {
  const aviso = (tipo: string, detalle: unknown = {}): AvisoAsistencia => ({
    id: tipo, tipo, sesionId, catequizandoId: ninoId, marcaId: null, detalle, estado: "abierto", atendidoEn: null, atendidoPor: null,
  });

  test("RF-310: la revisión cruzada pide confirmar y va primero", () => {
    const ordenados = ordenarAvisos([aviso("rechazo_registro", { motivo: "carne_invalido" }), aviso("revision_cruzada"), aviso("conflicto_registro")]);
    expect(ordenados.map((fila) => fila.tipo)).toEqual(["revision_cruzada", "conflicto_registro", "rechazo_registro"]);
    expect(etiquetaAviso("revision_cruzada").etiqueta).toBe("Revisión cruzada");
    expect(textoAviso(aviso("revision_cruzada"), "Vargas, Mateo")).toContain("Vargas, Mateo estuvo en misa");
  });

  test("RF-303: un carné inválido se explica sin datos personales", () => {
    expect(textoAviso(aviso("rechazo_registro", { motivo: "carne_invalido" }), null)).toBe(
      "Se leyó un carné no válido. No cuenta como asistencia."
    );
  });

  test("RF-306: los grupos propios aparecen primero y después todos", () => {
    const grupos = gruposParaLista(
      [{ id: "g2", nombre: "Grupo B" }, { id: "g1", nombre: "Grupo C", es_mio: true }, { id: "g3", nombre: "Grupo A" }],
      [{ id: "n1", grupo_id: "g2", activo: true }, { id: "n2", grupo_id: "g2", activo: false }]
    );
    expect(grupos.map((grupo) => grupo.id)).toEqual(["g1", "g3", "g2"]);
    expect(grupos[2].ninos).toBe(1);
  });

  test("RF-312: el reporte abre el domingo de la fecha o el anterior", () => {
    expect(domingoDeReferencia("2026-10-18")).toBe("2026-10-18");
    expect(domingoDeReferencia("2026-10-21")).toBe("2026-10-18");
  });
});
