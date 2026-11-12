import { useCallback, useEffect, useRef } from "react";
import { router, usePathname } from "expo-router";

import { ES_DESARROLLO } from "@/plataforma/config";
import { contextoDeSesion, useSesion } from "./contexto-sesion";

/**
 * Modo demostracion: al abrir la app se entra directo a pasar lista, sin
 * enlace y sin PIN. Es una ayuda de desarrollo y demostracion, nunca de
 * produccion:
 *
 * - Solo actúa en desarrollo (`ES_DESARROLLO`).
 * - Solo actúa si `EXPO_PUBLIC_DEMO_ENLACE` trae el token del enlace de demo.
 * - El token es una credencial de demostracion: la siembra lo emite y lo
 *   revoca en cada repetition.
 *
 * Si ya hay una sesion guardada, la abre con el PIN de demo. El PIN queda en
 * el dispositivo con su sal y su hash, como cualquier sesion.
 */
export function DemoDirecto() {
  const { cargando, tipo, desbloqueada, gestor, iniciarSesion, desbloquearSesion } = useSesion();
  const iniciado = useRef(false);
  const ruta = usePathname();
  const rutaInicial = useRef(ruta);
  const token = ES_DESARROLLO ? process.env.EXPO_PUBLIC_DEMO_ENLACE : undefined;
  const pin = process.env.EXPO_PUBLIC_DEMO_PIN ?? "1234";

  /** La pantalla de acceso solo se deja si el usuario no abrio otra ruta. */
  const irAlMenu = useCallback(() => {
    // La ruta con la que se abrio la app: el router puede pasar por el indice
    // mientras carga la sesion y no se debe perder la pantalla pedida.
    const pedida = rutaInicial.current;
    if (pedida && pedida !== "/" && pedida !== "/acceso/desbloquear" && pedida !== "/acceso/fijar-pin") {
      router.replace(pedida as never);
      return;
    }
    router.replace("/asistencia");
  }, [rutaInicial]);

  useEffect(() => {
    if (!token || iniciado.current) return;
    // Se espera a que la sesion guardada se cargue: si esta, se abre con el
    // PIN de demo; si no, se activa la cuenta de demo.
    if (cargando) return;
    if (tipo === "equipo" && desbloqueada) {
      iniciado.current = true;
      irAlMenu();
      return;
    }
    iniciado.current = true;
    void (async () => {
      try {
        if (tipo === "equipo") {
          const resultado = await desbloquearSesion(pin);
          if (resultado.estado === "operativa" || resultado.estado === "requiere-conexion") {
            irAlMenu();
            return;
          }
        }
        const activacion = await gestor.activarEquipo(token);
        const sesion = await gestor.fijarPin(activacion, pin);
        iniciarSesion("equipo", contextoDeSesion(sesion), activacion.jwt);
        irAlMenu();
      } catch (fallo) {
        // Sin demo disponible se sigue el flujo normal (enlace y PIN).
        if (ES_DESARROLLO) {
          console.warn("Modo demo no disponible:", fallo instanceof Error ? fallo.message : fallo);
        }
      }
    })();
  }, [token, pin, cargando, tipo, desbloqueada, gestor, iniciarSesion, desbloquearSesion, irAlMenu]);

  return null;
}
