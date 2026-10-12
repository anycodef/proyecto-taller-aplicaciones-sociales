export async function alReconectar(puertos: { renovar: (pendientes: number) => Promise<"ok" | "credencial_terminada">; contarPendientes: () => Promise<number>; enviarPendientes: () => Promise<void>; descartarPendientes: () => Promise<void> }): Promise<{ rechazados: number }> {
  const pendientes = await puertos.contarPendientes();
  if (await puertos.renovar(pendientes) === "credencial_terminada") {
    await puertos.descartarPendientes();
    return { rechazados: pendientes };
  }
  await puertos.enviarPendientes();
  return { rechazados: 0 };
}
